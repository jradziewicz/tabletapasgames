# Abandoned sign-ups

An account that is still Incomplete, and was never Active, is deleted 3 days after it was created (`isAbandonedSignUp` in `libs/common/src/site/user.ts`). `AbandonedSignUps` (`libs/backend-services/src/users/abandonedSignUps.ts`) does it: a daily Cloud Scheduler job posts `/tasks/users/sweepAbandonedSignUps` to the tasks service, which reads every Incomplete account and, for each one due, skips it if it is seated in any game, rechecks the rule inside the transaction, and deletes it the same way a player deletes their own account (tombstone, freed username/email/linked logins, sessions, codes, preferences and subscriptions cleared). No confirmation email is sent.

The onboarding page tells unfinished sign-ups about the deadline.

## Rollout

1. Release the backend and the tasks service, then the frontend.
2. See who the first run would delete, without deleting anyone (from Cloud Shell or any machine that can reach the tasks service internally):
   `gcloud scheduler jobs create http abandoned-sign-ups-dry-run ... --uri '<tasks url>/tasks/users/sweepAbandonedSignUps?dryRun=true'`, run it once, read the log line (below), then delete that job.
3. Create the daily job below and run it once by hand. The first run deletes every abandoned sign-up since the site opened.

## Daily Cloud Scheduler job

The tasks service accepts internal traffic only, and Cloud Scheduler in the same project counts as internal. Find the tasks service URL with `gcloud run services describe tasks --region us-central1 --format 'value(status.url)'`.

```sh
gcloud scheduler jobs create http abandoned-sign-ups-daily \
  --project stellar-ventures-509504 \
  --location us-central1 \
  --schedule '45 0 * * *' \
  --time-zone Etc/UTC \
  --uri '<tasks service url>/tasks/users/sweepAbandonedSignUps' \
  --http-method POST \
  --headers Content-Type=application/json \
  --message-body '{}' \
  --attempt-deadline 300s
```

Run it once by hand with `gcloud scheduler jobs run abandoned-sign-ups-daily --location us-central1 --project stellar-ventures-509504`.

## Reading the logs

`"event":"abandoned_sign_up_sweep"` lists each account it looked at with its outcome: `deleted`, `due` (dry run), `kept` (it finished signing up first), `seated` (an Incomplete account seated in a game, kept; look at how it got there), `missing` or `failed`.
