-- =============================================================================
-- Glosario: no se repiten términos, sin importar tildes, mayúsculas, espacios
-- ni los dos puntos o el punto final.
-- Observatorio Empresarial - Uniempresarial
--
-- El índice anterior solo comparaba en minúsculas, así que «Ética» y «Etica:»
-- se podían crear por separado desde el formulario. Este índice aplica la misma
-- regla que ya usa la carga masiva, para la carga individual y la masiva.
-- =============================================================================

create unique index glosario_termino_normalizado_uk
    on public.glosario_termino (
        lower(translate(
            regexp_replace(regexp_replace(trim(termino), '[\s:.]+$', ''), '\s+', ' ', 'g'),
            'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'))
    );
comment on index public.glosario_termino_normalizado_uk is
    'Un término no se repite aunque cambien tildes, mayúsculas, espacios o los dos puntos finales.';
