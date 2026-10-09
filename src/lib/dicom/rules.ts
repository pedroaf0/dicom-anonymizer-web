// Regras de anonimização. Este arquivo é a única fonte das regras: a tela
// "Como funciona" é gerada a partir dele, então o que você lê na interface é
// exatamente o que o código faz.
//
// Base: perfil básico de confidencialidade da norma DICOM PS3.15, Anexo E.

import { tagInfo } from "./tags";

export type Tag = number;

export const t = (group: number, elem: number): Tag => (group << 16) | elem;

/** Atributos substituídos pelo novo nome / novo código escolhidos por você. */
export const REPLACE: Record<number, "name" | "id"> = {
  [t(0x0010, 0x0010)]: "name", // PatientName
  [t(0x0010, 0x0020)]: "id", // PatientID
  [t(0x0010, 0x1000)]: "id", // OtherPatientIDs
  [t(0x0010, 0x1001)]: "name", // OtherPatientNames
};

/** Sempre removidos: identificação direta de pessoa, local ou contato. */
export const REMOVE_ALWAYS: number[] = [
  t(0x0008, 0x0050), // AccessionNumber
  t(0x0008, 0x0051), // IssuerOfAccessionNumberSequence
  t(0x0008, 0x0080), // InstitutionName
  t(0x0008, 0x0081), // InstitutionAddress
  t(0x0008, 0x0082), // InstitutionCodeSequence
  t(0x0008, 0x0090), // ReferringPhysicianName
  t(0x0008, 0x0092), // ReferringPhysicianAddress
  t(0x0008, 0x0094), // ReferringPhysicianTelephoneNumbers
  t(0x0008, 0x0096), // ReferringPhysicianIdentificationSequence
  t(0x0008, 0x1048), // PhysiciansOfRecord
  t(0x0008, 0x1050), // PerformingPhysicianName
  t(0x0008, 0x1060), // NameOfPhysiciansReadingStudy
  t(0x0008, 0x1062), // PhysiciansReadingStudyIdentificationSequence
  t(0x0008, 0x1070), // OperatorsName
  t(0x0008, 0x1072), // OperatorIdentificationSequence
  t(0x0008, 0x1120), // ReferencedPatientSequence
  t(0x0008, 0x1125), // ReferencedVisitSequence
  t(0x0008, 0x1040), // InstitutionalDepartmentName
  t(0x0010, 0x0032), // PatientBirthTime
  t(0x0010, 0x0033), // PatientBirthDateInAlternativeCalendar
  t(0x0010, 0x0034), // PatientDeathDateInAlternativeCalendar
  t(0x0010, 0x1002), // OtherPatientIDsSequence
  t(0x0010, 0x1005), // PatientBirthName
  t(0x0010, 0x1040), // PatientAddress
  t(0x0010, 0x1050), // InsurancePlanIdentification
  t(0x0010, 0x1060), // PatientMotherBirthName
  t(0x0010, 0x1080), // MilitaryRank
  t(0x0010, 0x1081), // BranchOfService
  t(0x0010, 0x1090), // MedicalRecordLocator
  t(0x0010, 0x2000), // MedicalAlerts
  t(0x0010, 0x2110), // Allergies
  t(0x0010, 0x2150), // CountryOfResidence
  t(0x0010, 0x2152), // RegionOfResidence
  t(0x0010, 0x2154), // PatientTelephoneNumbers
  t(0x0010, 0x2155), // PatientTelecomInformation
  t(0x0010, 0x2160), // EthnicGroup
  t(0x0010, 0x2180), // Occupation
  t(0x0010, 0x21a0), // SmokingStatus
  t(0x0010, 0x21b0), // AdditionalPatientHistory
  t(0x0010, 0x21c0), // PregnancyStatus
  t(0x0010, 0x21d0), // LastMenstrualDate
  t(0x0010, 0x21f0), // PatientReligiousPreference
  t(0x0010, 0x2201), // PatientSpeciesDescription
  t(0x0010, 0x2202), // PatientSpeciesCodeSequence
  t(0x0010, 0x2203), // PatientSexNeutered
  t(0x0010, 0x2297), // ResponsiblePerson
  t(0x0010, 0x2298), // ResponsiblePersonRole
  t(0x0010, 0x2299), // ResponsibleOrganization
  t(0x0010, 0x4000), // PatientComments
  t(0x0020, 0x0010), // StudyID
  t(0x0032, 0x1032), // RequestingPhysician
  t(0x0032, 0x1033), // RequestingService
  t(0x0032, 0x4000), // StudyComments
  t(0x0038, 0x0010), // AdmissionID
  t(0x0038, 0x0011), // IssuerOfAdmissionID
  t(0x0038, 0x0040), // DischargeDiagnosisDescription
  t(0x0038, 0x0300), // CurrentPatientLocation
  t(0x0038, 0x0400), // PatientInstitutionResidence
  t(0x0038, 0x0500), // PatientState
  t(0x0040, 0x0275), // RequestAttributesSequence
  t(0x0040, 0x1001), // RequestedProcedureID
  t(0x0040, 0x1002), // ReasonForTheRequestedProcedure
  t(0x0040, 0x1003), // RequestedProcedurePriority
  t(0x0040, 0x1004), // PatientTransportArrangements
  t(0x0040, 0x1005), // RequestedProcedureLocation
  t(0x0070, 0x0084), // ContentCreatorName
  t(0x0088, 0x0130), // StorageMediaFileSetID
  t(0x0088, 0x0140), // StorageMediaFileSetUID
  t(0x0020, 0x3401), // ModifyingDeviceID
  t(0x0020, 0x3402), // ModifiedImageID
  t(0x0020, 0x3403), // ModifiedImageDate
  t(0x0020, 0x3404), // ModifyingDeviceManufacturer
  t(0x0020, 0x3405), // ModifiedImageTime
  t(0x0020, 0x3406), // ModifiedImageDescription
  t(0x0008, 0x0014), // InstanceCreatorUID
];

/** Datas e horas: removidas, deslocadas ou mantidas conforme a sua escolha. */
export const DATE_TAGS: number[] = [
  t(0x0008, 0x0020), // StudyDate
  t(0x0008, 0x0021), // SeriesDate
  t(0x0008, 0x0022), // AcquisitionDate
  t(0x0008, 0x0023), // ContentDate
  t(0x0008, 0x002a), // AcquisitionDateTime
  t(0x0008, 0x0030), // StudyTime
  t(0x0008, 0x0031), // SeriesTime
  t(0x0010, 0x0030), // PatientBirthDate
  t(0x0018, 0x1012), // DateOfSecondaryCapture
  t(0x0018, 0x1200), // DateOfLastCalibration
  t(0x0018, 0x1201), // TimeOfLastCalibration
  t(0x0018, 0x1202), // DateTimeOfLastCalibration
  t(0x0018, 0x1203), // CalibrationDateTime
  t(0x0038, 0x0020), // AdmittingDate
  t(0x0038, 0x0021), // AdmittingTime
  t(0x0040, 0x0244), // PerformedProcedureStepStartDate
  t(0x0040, 0x0250), // PerformedProcedureStepEndDate
];

/** Identificação do equipamento, do local e do software. */
export const DEVICE_TAGS: number[] = [
  t(0x0008, 0x0070), // Manufacturer
  t(0x0008, 0x1010), // StationName
  t(0x0008, 0x1090), // ManufacturerModelName
  t(0x0018, 0x1000), // DeviceSerialNumber
  t(0x0018, 0x1002), // DeviceUID
  t(0x0018, 0x1003), // DeviceID
  t(0x0018, 0x1004), // PlateID
  t(0x0018, 0x1005), // GeneratorID
  t(0x0018, 0x1007), // CassetteID
  t(0x0018, 0x1008), // GantryID
  t(0x0018, 0x1016), // SecondaryCaptureDeviceManufacturer
  t(0x0018, 0x1019), // SecondaryCaptureDeviceSoftwareVersions
  t(0x0040, 0x0241), // PerformedStationAETitle
  t(0x0040, 0x0242), // PerformedStationName
  t(0x0040, 0x0243), // PerformedLocation
  t(0x0040, 0x0253), // PerformedProcedureStepID
];

/** Descrições e comentários em texto livre (podem conter nomes). */
export const DESCRIPTION_TAGS: number[] = [
  t(0x0008, 0x1030), // StudyDescription
  t(0x0008, 0x103e), // SeriesDescription
  t(0x0032, 0x1060), // RequestedProcedureDescription
  t(0x0040, 0x0254), // PerformedProcedureStepDescription
];

/** Sexo e idade: mantidos por padrão (costumam ser necessários). */
export const SEX_AGE_TAGS: number[] = [
  t(0x0010, 0x0040), // PatientSex
  t(0x0010, 0x1010), // PatientAge
];

/** UIDs regenerados (mantêm o agrupamento do estudo, sem rastro do anterior). */
export const UID_TAGS: number[] = [
  t(0x0002, 0x0003), // MediaStorageSOPInstanceUID (File Meta)
  t(0x0008, 0x0018), // SOPInstanceUID
  t(0x0008, 0x1155), // ReferencedSOPInstanceUID
  t(0x0020, 0x000d), // StudyInstanceUID
  t(0x0020, 0x000e), // SeriesInstanceUID
  t(0x0020, 0x0052), // FrameOfReferenceUID
  t(0x0020, 0x0200), // SynchronizationFrameOfReferenceUID
  t(0x0040, 0xa124), // UID
];

/** Campos mostrados na pré-visualização "antes → depois". */
export const PREVIEW_TAGS: number[] = [
  t(0x0010, 0x0010),
  t(0x0010, 0x0020),
  t(0x0010, 0x0030),
  t(0x0010, 0x0040),
  t(0x0010, 0x1010),
  t(0x0010, 0x1040),
  t(0x0010, 0x2154),
  t(0x0010, 0x2180),
  t(0x0010, 0x4000),
  t(0x0008, 0x0050),
  t(0x0008, 0x0080),
  t(0x0008, 0x0081),
  t(0x0008, 0x0090),
  t(0x0008, 0x1030),
  t(0x0008, 0x103e),
  t(0x0008, 0x1050),
  t(0x0008, 0x1070),
  t(0x0020, 0x000d),
  t(0x0020, 0x000e),
  t(0x0020, 0x0010),
  t(0x0008, 0x0020),
  t(0x0008, 0x0021),
  t(0x0008, 0x0022),
  t(0x0018, 0x1000),
  t(0x0008, 0x0070),
  t(0x0008, 0x1090),
  t(0x0008, 0x1010),
  t(0x0010, 0x1000),
];

export type DateMode = "remove" | "shift" | "keep";

export interface AnonOptions {
  patientName: string;
  patientId: string;
  dateMode: DateMode;
  keepSexAge: boolean;
  removeDevice: boolean;
  removeDescriptions: boolean;
  removePrivateTags: boolean;
}

export const DEFAULT_OPTIONS: AnonOptions = {
  patientName: "ANONIMIZADO",
  patientId: "ANONIMIZADO",
  dateMode: "shift",
  keepSexAge: true,
  removeDevice: true,
  removeDescriptions: true,
  removePrivateTags: true,
};

export interface RuleDoc {
  tag: string;
  name: string;
  action: string;
}

function docs(list: number[], action: string): RuleDoc[] {
  return list
    .map((tag) => {
      const group = (tag >>> 16) & 0xffff;
      const elem = tag & 0xffff;
      const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
      return {
        tag: `(${hex(group)},${hex(elem)})`,
        name: tagInfo(group, elem)?.name ?? "",
        action,
      };
    })
    .sort((a, b) => (a.tag < b.tag ? -1 : 1));
}

/** Lista completa mostrada na seção "Como funciona". */
export function allRules(): { group: string; items: RuleDoc[] }[] {
  return [
    { group: "Substituído pelo novo nome/código", items: docs(Object.keys(REPLACE).map(Number), "substituído") },
    { group: "Sempre removido", items: docs(REMOVE_ALWAYS, "removido") },
    { group: "Datas e horas", items: docs(DATE_TAGS, "removida ou deslocada") },
    { group: "Equipamento e local", items: docs(DEVICE_TAGS, "removido") },
    { group: "Descrições em texto livre", items: docs(DESCRIPTION_TAGS, "removido") },
    { group: "Sexo e idade", items: docs(SEX_AGE_TAGS, "mantido por padrão") },
    { group: "Identificadores técnicos (UIDs)", items: docs(UID_TAGS, "regenerado") },
  ];
}
