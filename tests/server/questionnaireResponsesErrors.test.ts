import assert from 'node:assert';
import type { Meteor } from 'meteor/meteor';
import QuestionnairesCollection from '../../imports/api/collections/questionnaires.collection';
import QuestionnaireResponsesCollection from '../../imports/api/collections/questionnaireResponses.collection';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestDoc, createTestRole, createTestUser } from './fixtures';

// The UI translates these codes (imports/i18n/methodErrors.ts), so they are a
// contract: the server must throw the stable code, with parameters in details.
describe('questionnaireResponses.* — stable error codes (#364)', () => {
  let userId: string;

  before(async () => {
    const roleId = await createTestRole({ questionnaires: { read: true, create: false, update: false, delete: false } });
    userId = await createTestUser({ roleId });
  });

  after(async () => {
    await QuestionnaireResponsesCollection.removeAsync({ respondentId: userId });
    await cleanupFixtures([QuestionnairesCollection, QuestionnaireResponsesCollection]);
  });

  function createQuestionnaire(overrides: Record<string, unknown> = {}): Promise<string> {
    return createTestDoc(QuestionnairesCollection, {
      name: 'Error codes',
      status: 'active',
      interval: 'once',
      questions: [{ text: 'Why?', type: 'text', required: true }],
      ...overrides,
    });
  }

  it('rejects an inactive questionnaire with questionnaire-not-active', async () => {
    const id = await createQuestionnaire({ status: 'draft' });
    await assertRejectsWithCode(() => callAs(userId, 'questionnaireResponses.submit', id, []), 'questionnaire-not-active');
  });

  it('rejects a missing required answer with the question text in details', async () => {
    const id = await createQuestionnaire();
    await assert.rejects(
      () => callAs(userId, 'questionnaireResponses.submit', id, []),
      (error: unknown) => {
        const err = error as Meteor.Error;
        return err.error === 'questionnaire-answer-required' && (err.details as { question?: string }).question === 'Why?';
      }
    );
  });

  it('rejects an invalid answer type with questionnaire-answer-invalid', async () => {
    const id = await createQuestionnaire();
    await assertRejectsWithCode(
      () => callAs(userId, 'questionnaireResponses.submit', id, [{ questionIndex: 0, value: 42 }]),
      'questionnaire-answer-invalid'
    );
  });

  it('rejects a second one-time response with questionnaire-already-responded', async () => {
    const id = await createQuestionnaire();
    await callAs(userId, 'questionnaireResponses.submit', id, [{ questionIndex: 0, value: 'Because' }]);
    await assertRejectsWithCode(
      () => callAs(userId, 'questionnaireResponses.submit', id, [{ questionIndex: 0, value: 'Again' }]),
      'questionnaire-already-responded'
    );
  });

  it('rejects a response within the interval with a cooldown code and ISO nextAllowedDate', async () => {
    const id = await createQuestionnaire({ interval: 'daily' });
    await callAs(userId, 'questionnaireResponses.submit', id, [{ questionIndex: 0, value: 'Today' }]);
    await assert.rejects(
      () => callAs(userId, 'questionnaireResponses.submit', id, [{ questionIndex: 0, value: 'Again' }]),
      (error: unknown) => {
        const err = error as Meteor.Error;
        const next = (err.details as { nextAllowedDate?: string }).nextAllowedDate;
        return err.error === 'questionnaire-response-cooldown' && typeof next === 'string' && new Date(next).getTime() > Date.now();
      }
    );
  });

  it('returns a null respondentName for anonymous responses (translated client-side)', async () => {
    const id = await createQuestionnaire({ allowAnonymous: true });
    const responseId = await createTestDoc(QuestionnaireResponsesCollection, {
      questionnaireId: id,
      respondentId: null,
      answers: [],
      submittedAt: new Date(),
    });
    const responses = (await callAs(userId, 'questionnaireResponses.getForQuestionnaire', id)) as Array<{ _id: string; respondentName: unknown }>;
    const row = responses.find(r => r._id === responseId);
    assert.ok(row);
    assert.strictEqual(row.respondentName, null);
  });
});
