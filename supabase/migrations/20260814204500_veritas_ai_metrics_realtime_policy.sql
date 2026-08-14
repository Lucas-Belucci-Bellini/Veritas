create policy veritas_realtime_ai_metrics_read
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() = 'veritas:ai-metrics:' || (select auth.uid())::text
  );
