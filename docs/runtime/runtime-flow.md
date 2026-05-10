# Runtime App Flow

## Source Files

- `tenantapp/app/layout.tsx`
- `tenantapp/runtime/context/RuntimeContext.ts`
- `tenantapp/runtime/providers/RuntimeConfigProvider.tsx`
- `tenantapp/runtime/hooks/useRuntimeConfig.ts`
- `tenantapp/runtime/hooks/useRuntimeAttributeForm.ts`
- `tenantapp/runtime/attributes/attributeTemplateUtils.ts`
- `tenantapp/runtime/attributes/surveySession.ts`
- `tenantapp/app/survey/page.tsx`
- `tenantapp/app/survey-questions/page.tsx`
- `tenantapp/components/survey/SurveyContainer.tsx`
- `tenantapp/runtime/providers/surveyService.ts`
- `tenantapp/app/api/survey/submit/route.ts`

## App Bootstrap

`tenantapp/app/layout.tsx` wraps the app with:

1. `RuntimeConfigProvider`
2. `Header`
3. route content

`RuntimeContext` exposes:

- `config`
- `loading`
- `error`
- `tenantSlug`

Current implementation notes:

- `loading` stays `false`
- `error` stays `null`
- `config` comes from `mockTenantRegistry`

## Active Public Survey Path

1. `GET /survey`
2. `useRuntimeAttributeForm()` resolves the active tenant attribute template
3. runtime validation gates the "Start Survey" action
4. selected attributes are saved to `sessionStorage`
5. `GET /survey-questions`
6. the question route reads the saved runtime attribute session
7. answers are recorded by `questionId`
8. the final step submits a batch payload to `/api/survey/submit`
9. success clears the stored session and shows the thank-you state

## Active Attribute Session

`tenantapp/runtime/attributes/surveySession.ts` persists:

- `tenantId`
- `tenantSlug`
- `scannerVersionId`
- `attributes`
- `savedAt`

Runtime safeguards:

- mismatched tenant/session pairs are rejected
- malformed sessions are cleared
- `/survey-questions` shows a recovery state if the session is missing

## Active Question Rendering

`tenantapp/app/survey-questions/page.tsx` currently:

- flattens `category -> subdomain -> question`
- keeps `categoryLabel`, `subdomainLabel`, `polarity`, `questionText`, and `options`
- stores answers in `Record<questionId, answerIndex>`
- submits one batch payload after the last question

The mounted route still ignores:

- `question.weight`
- `question.isInverted`
- `question.isFollowUp`
- `question.scoring`
- `subdomain.followUpRules`
- `runtimeSettings.featureFlags.enableFollowUps`

## Local Submit Stub

`tenantapp/app/api/survey/submit/route.ts` now requires:

- `tenantId`
- `scannerVersionId`
- `attributes`
- `responses`

It validates only:

- presence of those top-level fields
- string-valued runtime attributes
- string `questionId`
- numeric `answerIndex`

It still does not validate:

- scanner membership for each question
- answer-index range against question option count
- duplicate responses
- follow-up consistency
- runtime settings such as authentication or anonymous access

## Secondary Survey Path Still Present

`tenantapp/components/survey/SurveyContainer.tsx` remains unmounted.

Current behavior:

- it supports follow-up visibility rules
- it now submits the same batch contract shape as the active path
- it still counts all questions in `totalQuestions`, even if follow-ups stay hidden

## Runtime Boundaries

Implemented:

- tenant switching
- theme injection
- runtime-driven attribute rendering
- runtime attribute validation and persistence
- question submission to a local Next route
- dashboard route theming

Not implemented:

- API-backed runtime config fetch
- persisted survey answers outside the local stub
- runtime-backed dashboard aggregation fetch
- auth behavior from `runtimeSettings`
- follow-up/scoring behavior in the mounted survey route
