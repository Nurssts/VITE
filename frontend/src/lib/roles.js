// Roles of a team member in VITE. The role tailors the AI Strategist's answers and defaults.
import { tr } from "./i18n";

export const ROLES = [
  { id: "scout", ru: "Скаут", hint: "Записываю матчи с трибуны" },
  { id: "strategist", ru: "Стратег / аналитик", hint: "Готовлю драфт и пик-лист" },
  { id: "drive_coach", ru: "Тренер драйв-команды", hint: "Веду команду на поле" },
  { id: "driver", ru: "Пилот", hint: "Управляю роботом" },
  { id: "operator", ru: "Оператор", hint: "Второй пилот / механизмы" },
  { id: "captain", ru: "Капитан команды", hint: "Выбираю альянс" },
  { id: "mentor", ru: "Ментор", hint: "Наставник команды" },
  { id: "other", ru: "Другое", hint: "" },
];

/** Label in the current language (labels are Russian keys translated by tr()). */
export function roleLabel(id) {
  const r = ROLES.find((x) => x.id === id);
  return r ? tr(r.ru) : "";
}

export function roleHint(id) {
  const r = ROLES.find((x) => x.id === id);
  return r?.hint ? tr(r.hint) : "";
}
