import { useState } from 'react';
import { useSectores } from '../../api/consultas';
import { Entrada, Selector } from './Campos';

const OTRO = '__otro__';
/** Valor provisional de las empresas que aún no completan su ficha. */
const POR_DEFINIR = 'Por definir';

/**
 * Sector económico: uno de los 21 sectores CIIU o, con "Otro", uno escrito a mano. El sector
 * escrito queda solo en esa empresa: no se agrega a la lista.
 */
export function CampoSector({
  valor,
  onCambiar,
  error,
  variante,
}: {
  valor: string;
  onCambiar: (valor: string) => void;
  error?: string;
  variante?: 'perfil';
}) {
  const { data: sectores = [] } = useSectores();
  const [eligioOtro, setEligioOtro] = useState(false);
  const enLista = sectores.some((s) => s.nombre === valor);
  // Un sector guardado que no está en la lista es un "Otro" escrito a mano.
  const otro = eligioOtro || (sectores.length > 0 && !!valor && valor !== POR_DEFINIR && !enLista);
  const opciones = [...sectores.map((s) => ({ valor: s.nombre, texto: s.nombre })), { valor: OTRO, texto: 'Otro (escribir)' }];

  return (
    <>
      <Selector
        etiqueta="Sector"
        obligatorio
        vacio="Selecciona el sector"
        opciones={opciones}
        value={otro ? OTRO : enLista ? valor : ''}
        error={otro ? undefined : error}
        onChange={(ev) => {
          const elegido = ev.target.value;
          setEligioOtro(elegido === OTRO);
          onCambiar(elegido === OTRO ? '' : elegido);
        }}
      />
      {otro && (
        <Entrada
          variante={variante}
          etiqueta="¿Cuál sector?"
          obligatorio
          maxLength={100}
          placeholder="Escribe el sector de la empresa"
          value={valor}
          error={error}
          onChange={(ev) => onCambiar(ev.target.value)}
        />
      )}
    </>
  );
}
