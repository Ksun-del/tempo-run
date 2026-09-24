/** Обращение к бегуну: она / он. Пока не выбрано — говорим в женском роде. */
export type Gender = 'f' | 'm' | '';

/** «Готова» / «Готов» */
export const g = (gender: Gender, f: string, m: string) => (gender === 'm' ? m : f);

/** Подставляет окончание: «пробежал{а}» → «пробежала» или «пробежал» */
export const fill = (text: string, gender: Gender) => text.replace(/\{а\}/g, gender === 'm' ? '' : 'а');
