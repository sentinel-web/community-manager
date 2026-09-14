import assert from 'node:assert';
import { ATTENDANCE_STATUS_META, ATTENDANCE_STATUSES } from '../../imports/api/attendance/status';
import { translations } from '../../imports/i18n';

// One status → { label, color } map shared by the attendance grid tags, the
// grid dropdown, and the profile pie chart (#365).

describe('attendance status map (#365)', () => {
  it('lists every attendance status in grid order', () => {
    assert.deepStrictEqual([...ATTENDANCE_STATUSES], [-2, -1, 0, 1, 2]);
  });

  it('maps every status to an existing translation key', () => {
    for (const status of ATTENDANCE_STATUSES) {
      const { labelKey } = ATTENDANCE_STATUS_META[status];
      assert.ok(labelKey in translations, `status ${status} uses unknown label key ${labelKey}`);
    }
  });

  it('uses the requested tag colors', () => {
    assert.deepStrictEqual(
      ATTENDANCE_STATUSES.map(status => ATTENDANCE_STATUS_META[status].tagColor),
      ['#000000', 'red', 'gold', 'green', 'blue']
    );
  });

  it('gives every status a hex chart color', () => {
    for (const status of ATTENDANCE_STATUSES) {
      assert.match(ATTENDANCE_STATUS_META[status].chartColor, /^#[0-9a-f]{6}$/i);
    }
  });

  it('labels the no-show status as unexcused in every locale', () => {
    assert.deepStrictEqual(translations['events.absent'], {
      en: 'Absent (Unexcused)',
      de: 'Abwesend (Unabgemeldet)',
      fr: 'Absent (Non excusé)',
    });
  });
});
