-- Nombres de tendencias en formato de oración: solo la primera letra en mayúscula y el resto
-- en minúscula, conservando las siglas conocidas (IA, ESG, PYMES, IoT…). El backend aplica la
-- misma regla al guardar (formatoOracion en backend/src/utilidades/esquemas.ts); esta función
-- corrige las tendencias que ya existían.
create function public.fn_formato_oracion(texto text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
    siglas constant text[] := array['IA', 'AI', 'ESG', 'TIC', 'TICs', 'B2B', 'B2C', 'D2C', 'PYME', 'PYMES', 'MIPYME',
        'MIPYMES', 'ODS', 'RSE', 'KPI', 'CRM', 'ERP', 'ONG', 'API', 'UX', 'UI', 'VR', 'AR', 'NFT', 'PIB', 'SENA', 'DANE',
        'BPO', 'SaaS', 'IoT', '5G', '3D', 'ADN', 'LGBTIQ+', 'CO2'];
    palabra text;
    nucleo text;
    sigla text;
    partes text[] := '{}';
    frase text;
    pos int;
begin
    if texto is null then
        return null;
    end if;
    foreach palabra in array regexp_split_to_array(btrim(regexp_replace(texto, '\s+', ' ', 'g')), ' ') loop
        nucleo := regexp_replace(palabra, '^[^[:alnum:]]+|[^[:alnum:]+]+$', '', 'g');
        select s into sigla from unnest(siglas) s where upper(s) = upper(nucleo) limit 1;
        partes := partes || case when sigla is not null then replace(palabra, nucleo, sigla) else lower(palabra) end;
    end loop;
    frase := array_to_string(partes, ' ');
    pos := regexp_instr(frase, '[[:alpha:]]');
    if pos > 0 then
        frase := overlay(frase placing upper(substr(frase, pos, 1)) from pos for 1);
    end if;
    return frase;
end;
$$;
comment on function public.fn_formato_oracion(text) is 'Formato de oración conservando siglas (nombres de tendencias).';

update public.tendencia_empresarial
   set tendencia = public.fn_formato_oracion(tendencia)
 where tendencia is distinct from public.fn_formato_oracion(tendencia);
