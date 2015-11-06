package org.babelomics.team.app.cli;


import com.beust.jcommander.JCommander;
import com.beust.jcommander.ParameterException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.babelomics.team.lib.filters.TeamVariantGeneRegionFilter;
import org.babelomics.team.lib.io.TeamDiagnosticFileWriter;
import org.babelomics.team.lib.io.TeamSecondaryFindingsFileWriter;
import org.babelomics.team.lib.io.TeamVariantMongoReader;
import org.babelomics.team.lib.io.TeamVariantStdoutWriter;
import org.babelomics.team.lib.models.Disease;
import org.babelomics.team.lib.models.Gene;
import org.babelomics.team.lib.models.Panel;
import org.babelomics.team.lib.models.TeamVariant;
import org.opencb.biodata.formats.variant.io.VariantReader;
import org.opencb.biodata.formats.variant.io.VariantWriter;
import org.opencb.biodata.models.core.Region;
import org.opencb.biodata.models.variant.Variant;
import org.opencb.biodata.models.variant.avro.ClinVar;
import org.opencb.biodata.models.variant.avro.Cosmic;
import org.opencb.biodata.models.variant.avro.Gwas;
import org.opencb.biodata.models.variant.avro.VariantTraitAssociation;
import org.opencb.biodata.tools.variant.filtering.VariantFilter;
import org.opencb.commons.filters.FilterApplicator;
import org.opencb.commons.io.DataWriter;
import org.opencb.opencga.catalog.exceptions.CatalogException;
import org.opencb.opencga.storage.core.StorageManagerException;
import org.opencb.opencga.storage.core.config.StorageConfiguration;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

/**
 * @author Alejandro Alemán Ramos <aaleman@cipf.es>
 */
public class TeamMain {

    public static void main(String[] args) throws IOException, CatalogException, IllegalAccessException, InstantiationException, ClassNotFoundException, StorageManagerException {

        Parameters parameters = new Parameters();
        ObjectMapper mapper = new ObjectMapper();
        JCommander jc = new JCommander(parameters);


        String inputFile;
        String outputFile;
        String panelFilename;
        String sessionId;
        int studyId;

        try {
            jc.parse(args);
        } catch (ParameterException e) {
            jc.usage();
            System.exit(-1);
        }


        inputFile = parameters.getInput();
        panelFilename = parameters.getPanel();
        outputFile = parameters.getOutput();
        sessionId = parameters.getSessionId();
        studyId = parameters.getStudyId();


        Properties catalogProp = new Properties();
        catalogProp.load(TeamMain.class.getClassLoader().getResourceAsStream("catalog.properties"));

        StorageConfiguration storageConfiguration = StorageConfiguration.load(TeamMain.class.getClassLoader().getResourceAsStream("storage-configuration.yml"));

        Panel panel = null;

        int batchSize = 1;

        List<Variant> batch;
        List<VariantFilter> filters = new ArrayList<>();
        List<TeamVariant> diagnosticVariants = new ArrayList<>();
        List<TeamVariant> secondaryFindingsVariants = new ArrayList<>();

        java.io.File jsonPanelFile;


        System.out.println("inputFile = " + inputFile);
        System.out.println("panelFilename = " + panelFilename);
        System.out.println("outputFile = " + outputFile);

        jsonPanelFile = new java.io.File(panelFilename);
//
        try {
            panel = mapper.readValue(jsonPanelFile, Panel.class);


            List<Region> regionList = getRegionsFromPanel(panel);

            VariantReader reader = new TeamVariantMongoReader(catalogProp, storageConfiguration, studyId, sessionId);

            VariantWriter writer = new TeamVariantStdoutWriter();

            DataWriter<TeamVariant> diagnosticWriter = new TeamDiagnosticFileWriter(inputFile, outputFile + "/diagnostic.csv");
            DataWriter<TeamVariant> secondaryFindingsWriter = new TeamSecondaryFindingsFileWriter(inputFile, outputFile + "/secondary.csv");

            VariantFilter regionFilter = new TeamVariantGeneRegionFilter(regionList);
            filters.add(regionFilter);

//
            reader.open();
            writer.open();
            diagnosticWriter.open();
            secondaryFindingsWriter.open();

            reader.pre();
            writer.pre();
            diagnosticWriter.pre();
            secondaryFindingsWriter.pre();


            batch = reader.read(batchSize);

            while (batch != null && !batch.isEmpty()) {

                FilterApplicator.filter(batch, filters);

                run(batch, panel, diagnosticVariants, secondaryFindingsVariants);

                diagnosticWriter.write(diagnosticVariants);
                secondaryFindingsWriter.write(secondaryFindingsVariants);

                batch.clear();
                diagnosticVariants.clear();
                secondaryFindingsVariants.clear();

                batch = reader.read(batchSize);

            }

            reader.post();
            writer.post();
            diagnosticWriter.post();
            secondaryFindingsWriter.post();

            reader.close();
            writer.close();
            diagnosticWriter.close();
            secondaryFindingsWriter.close();

        } catch (IOException e) {
            e.printStackTrace();
        }


    }

    private static void run(List<Variant> batch, Panel panel, List<TeamVariant> diagnosticVariants, List<TeamVariant> secondaryFindingsVariants) {
        for (Variant variant : batch) {
            TeamVariant teamVariant = new TeamVariant(variant);
            if (isDiagnosticVariant(teamVariant, panel)) {
                diagnosticVariants.add(teamVariant);
            } else {
                secondaryFindingsVariants.add(teamVariant);
            }
        }

    }

    private static boolean isDiagnosticVariant(TeamVariant teamVariant, Panel panel) {
        Variant variant = teamVariant.getVariant();
        VariantTraitAssociation variantTraitAssociation = variant.getAnnotation().getVariantTraitAssociation();
        for (Disease disease : panel.getDiseases()) {

            // TODO aaleman: Check if the mutation is in the list of mutations (from the panel)
            if (variantTraitAssociation == null) {
                continue;
            }
            switch (disease.getSource().toLowerCase()) {
                case "clinvar":
                    if (variantTraitAssociation.getClinvar() != null && !variantTraitAssociation.getClinvar().isEmpty()) {
                        for (ClinVar clinvar : variantTraitAssociation.getClinvar()) {
                            for (String trait : clinvar.getTraits()) {
                                if (trait.equalsIgnoreCase(disease.getPhenotype())) {
                                    teamVariant.setPhenotype(disease.getPhenotype());
                                    teamVariant.setSource("clinvar");
                                    return true;
                                }
                            }
                        }
                    }
                    break;
                case "cosmic":
                    if (variantTraitAssociation.getCosmic() != null && !variantTraitAssociation.getCosmic().isEmpty()) {
                        for (Cosmic cosmic : variantTraitAssociation.getCosmic()) {
                            if (cosmic.getPrimaryHistology().equalsIgnoreCase(disease.getPhenotype())) {
                                teamVariant.setPhenotype(disease.getPhenotype());
                                teamVariant.setSource("cosmic");
                                return true;
                            }
                        }
                    }
                    break;
                case "gwas":
                    if (variantTraitAssociation.getGwas() != null && !variantTraitAssociation.getGwas().isEmpty()) {
                        for (Gwas gwas : variantTraitAssociation.getGwas()) {
                            for (String trait : gwas.getTraits()) {
                                if (trait.equalsIgnoreCase(disease.getPhenotype())) {
                                    teamVariant.setPhenotype(disease.getPhenotype());
                                    teamVariant.setSource("gwas");
                                    return true;
                                }
                            }
                        }
                    }
                    break;
            }
        }

        return false;
    }

    private static List<Region> getRegionsFromPanel(Panel p) {
        List<Region> list = new ArrayList<>();

        for (Gene g : p.getGenes()) {
            if (g.getChr() != null && !g.getChr().isEmpty()) {
                list.add(new Region(g.getChr(), g.getStart(), g.getEnd()));
            }
        }

        return list;

    }
}
