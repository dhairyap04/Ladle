// "1 pickup", "3 pickups". `plural` defaults to adding an s.
export const plural = (n, singular, pluralForm = `${singular}s`) => `${n} ${n === 1 ? singular : pluralForm}`;
