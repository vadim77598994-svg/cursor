from pydantic import BaseModel, Field


class PatientData(BaseModel):
    patient_fio: str = Field(..., description="ФИО пациента")
    patient_birth_date: str | None = Field(None, description="Дата рождения")
    passport_series: str | None = None
    passport_number: str | None = None
    passport_issued_by: str | None = None
    passport_date: str | None = None
    reg_address: str | None = None
    patient_email: str | None = Field(None, description="Email для отправки PDF")


class GenerateContractRequest(BaseModel):
    location_id: str = Field(..., description="ID кабинета")
    staff_id: str = Field(..., description="ID оптометриста")
    patient: PatientData
    signature_data_url: str | None = Field(None, description="Data URL подписи клиента (canvas)")
    device_uuid: str | None = None
