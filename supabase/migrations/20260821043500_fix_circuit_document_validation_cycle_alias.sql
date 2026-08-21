create or replace function private.veritas_validate_circuit_document(p_document jsonb)
returns text[]
language plpgsql
immutable
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  issues text[] := '{}';
  node jsonb;
  connection jsonb;
  node_ids text[] := '{}';
  node_id text;
  node_type text;
  source_node text;
  target_node text;
  source_port integer;
  target_port integer;
  input_count integer;
  source_width integer;
  target_width integer;
  source_type text;
  target_type text;
  width_text text;
  position_x text;
  position_y text;
  has_invalid_width boolean := false;
  has_combinational_cycle boolean := false;
begin
  if p_document is null or coalesce(jsonb_typeof(p_document), '') <> 'object' then
    return array_append(issues, 'invalid-document');
  end if;

  if coalesce(p_document->>'format', '') <> 'veritas-circuit' then
    issues := array_append(issues, 'invalid-format');
  end if;
  if coalesce(p_document->>'version', '') !~ '^[0-9]+$'
     or (p_document->>'version')::integer <> 1 then
    issues := array_append(issues, 'unsupported-version');
  end if;
  if char_length(btrim(coalesce(p_document->>'name', ''))) < 1
     or char_length(p_document->>'name') > 200 then
    issues := array_append(issues, 'invalid-name');
  end if;
  if coalesce(jsonb_typeof(p_document->'nodes'), '') <> 'array' then
    issues := array_append(issues, 'invalid-nodes');
  end if;
  if coalesce(jsonb_typeof(p_document->'connections'), '') <> 'array' then
    issues := array_append(issues, 'invalid-connections');
  end if;
  if cardinality(issues) > 0 then
    return issues;
  end if;

  for node in select value from jsonb_array_elements(p_document->'nodes') loop
    if coalesce(jsonb_typeof(node), '') <> 'object' then
      issues := array_append(issues, 'invalid-node');
      continue;
    end if;

    node_id := nullif(btrim(node->>'id'), '');
    if node_id is null then
      issues := array_append(issues, 'duplicate-node');
      continue;
    end if;
    if node_id = any(node_ids) then
      issues := array_append(issues, 'duplicate-node');
    else
      node_ids := array_append(node_ids, node_id);
    end if;

    node_type := node->>'type';
    if node_type is null or not (node_type = any(array[
      'input', 'output', 'constant', 'and', 'or', 'not', 'xor',
      'clock', 'dff', 'tff', 'delay'
    ]::text[])) then
      issues := array_append(issues, 'invalid-node');
    end if;

    if coalesce(jsonb_typeof(node->'position'), '') <> 'object' then
      issues := array_append(issues, 'invalid-position');
    else
      position_x := node->'position'->>'x';
      position_y := node->'position'->>'y';
      if coalesce(position_x, '') !~ '^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$'
         or coalesce(position_y, '') !~ '^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$' then
        issues := array_append(issues, 'invalid-position');
      end if;
    end if;

    if node ? 'options' and coalesce(jsonb_typeof(node->'options'), '') <> 'object' then
      issues := array_append(issues, 'invalid-options');
    elsif node->'options' ? 'width' then
      width_text := node->'options'->>'width';
      if coalesce(width_text, '') !~ '^[0-9]+$' then
        issues := array_append(issues, 'invalid-width');
        has_invalid_width := true;
      else
        source_width := width_text::integer;
        if source_width < 1 or source_width > 64 then
          issues := array_append(issues, 'invalid-width');
          has_invalid_width := true;
        end if;
      end if;
    end if;
  end loop;

  if cardinality(issues) > 0 and has_invalid_width then
    return issues;
  end if;

  for connection in select value from jsonb_array_elements(p_document->'connections') loop
    if coalesce(jsonb_typeof(connection), '') <> 'object'
       or coalesce(jsonb_typeof(connection->'source'), '') <> 'object'
       or coalesce(jsonb_typeof(connection->'target'), '') <> 'object' then
      issues := array_append(issues, 'invalid-connection');
      continue;
    end if;

    source_node := nullif(btrim(connection->'source'->>'node'), '');
    target_node := nullif(btrim(connection->'target'->>'node'), '');
    if source_node is null or target_node is null then
      issues := array_append(issues, 'missing-node');
      continue;
    end if;

    if connection->'source' ? 'port' then
      if coalesce(connection->'source'->>'port', '') !~ '^[0-9]+$' then
        issues := array_append(issues, 'invalid-source-port');
        continue;
      end if;
      source_port := (connection->'source'->>'port')::integer;
    else
      source_port := 0;
    end if;

    if not (connection->'target' ? 'port')
       or coalesce(connection->'target'->>'port', '') !~ '^[0-9]+$' then
      issues := array_append(issues, 'invalid-target-port');
      continue;
    end if;
    target_port := (connection->'target'->>'port')::integer;

    select n->>'type', coalesce(nullif(n->'options'->>'width', '')::integer, 1)
      into source_type, source_width
      from jsonb_array_elements(p_document->'nodes') as item(n)
     where n->>'id' = source_node
     limit 1;
    select n->>'type', coalesce(nullif(n->'options'->>'width', '')::integer, 1)
      into target_type, target_width
      from jsonb_array_elements(p_document->'nodes') as item(n)
     where n->>'id' = target_node
     limit 1;

    if source_type is null or target_type is null then
      issues := array_append(issues, 'missing-node');
      continue;
    end if;
    if source_port <> 0 then
      issues := array_append(issues, 'invalid-source-port');
    end if;

    input_count := case
      when target_type in ('input', 'constant', 'clock') then 0
      when target_type in ('not', 'output', 'delay') then 1
      when target_type in ('and', 'or', 'xor', 'dff', 'tff') then 2
      else 0
    end;
    if target_port < 0 or target_port >= input_count then
      issues := array_append(issues, 'invalid-target-port');
    end if;
    if source_width <> target_width then
      issues := array_append(issues, 'width-mismatch');
    end if;
    if source_node = target_node and target_type not in ('clock', 'dff', 'tff', 'delay') then
      issues := array_append(issues, 'self-connection');
    end if;
  end loop;

  if exists (
    select 1
      from (
        select c.value->'target'->>'node' as target_node,
               (c.value->'target'->>'port')::integer as target_port,
               count(*) as connection_count
          from jsonb_array_elements(p_document->'connections') as c(value)
         where (c.value->'target'->>'port') ~ '^[0-9]+$'
         group by c.value->'target'->>'node', (c.value->'target'->>'port')::integer
      ) as duplicates
     where duplicates.connection_count > 1
  ) then
    issues := array_append(issues, 'duplicate-target-port');
  end if;

  for node in select value from jsonb_array_elements(p_document->'nodes') loop
    node_id := node->>'id';
    node_type := node->>'type';
    input_count := case
      when node_type in ('input', 'constant', 'clock') then 0
      when node_type in ('not', 'output', 'delay') then 1
      when node_type in ('and', 'or', 'xor', 'dff', 'tff') then 2
      else 0
    end;
    for target_port in 0..greatest(input_count - 1, -1) loop
      if input_count > 0 and not exists (
        select 1
          from jsonb_array_elements(p_document->'connections') as c(value)
         where c.value->'target'->>'node' = node_id
           and (c.value->'target'->>'port') ~ '^[0-9]+$'
           and (c.value->'target'->>'port')::integer = target_port
      ) then
        issues := array_append(issues, 'missing-input');
      end if;
    end loop;
  end loop;

  with recursive walk(start_id, current_id, path, has_state) as (
    select n->>'id', n->>'id', array[n->>'id'], false
      from jsonb_array_elements(p_document->'nodes') as item(n)
     where n->>'id' is not null
    union all
    select w.start_id,
           c.value->'target'->>'node',
           w.path || (c.value->'target'->>'node'),
           w.has_state or exists (
             select 1
               from jsonb_array_elements(p_document->'nodes') as target_item(target_json)
              where target_json->>'id' = c.value->'target'->>'node'
                and target_json->>'type' in ('clock', 'dff', 'tff', 'delay')
           )
      from walk as w
      join jsonb_array_elements(p_document->'connections') as c(value)
        on c.value->'source'->>'node' = w.current_id
     where cardinality(w.path) < 128
  )
  select exists (
    select 1
      from walk
     where current_id = any(path[1:cardinality(path) - 1])
       and not has_state
  ) into has_combinational_cycle;

  if has_combinational_cycle then
    issues := array_append(issues, 'cycle');
  end if;

  return issues;
end;
$$;

revoke all on function private.veritas_validate_circuit_document(jsonb) from public, anon, authenticated;
grant execute on function private.veritas_validate_circuit_document(jsonb) to authenticated;
