import { strings } from '../../../locales/i18n';

export function toLocaleDateTime(timestamp) {
  const dateObj = new Date(timestamp);
  const date = dateObj.toLocaleDateString();
  const time = dateObj.toLocaleTimeString();
  return `${date} ${time}`;
}

export function toDateFormat(timestamp) {
  const date = new Date(timestamp);
  const month = strings(`date.months.${date.getMonth()}`);
  const day = date.getDate();
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours %= 12;
  hours = hours || 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return `${month} ${day} ${strings(
    'date.connector',
  )} ${hours}:${minutes} ${ampm}`;
}

export function toLocaleDate(timestamp) {
  return new Date(timestamp).toLocaleDateString();
}

export function toLocaleTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * This function will return the diference in days betwen two dates
 * @param {number} sessionTime - a number that represents a date, it need to be without separators, example: 19960212
 */
export function getDiffBetweenTodayDate(sessionTime) {
  const today = JSON.stringify(new Date()).split('T')[0];
  const todayToNumber = Number(today.replace(/[-"]/g, ''));

  return todayToNumber - sessionTime;
}
