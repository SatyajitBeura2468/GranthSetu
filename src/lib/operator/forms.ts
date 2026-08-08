export function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function nullable(value: string) {
  return value === "" ? null : value;
}

export function uuidList(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter((value) => /^[0-9a-f-]{36}$/i.test(value));
}
