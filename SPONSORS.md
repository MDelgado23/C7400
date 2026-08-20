# Cómo editar `sponsors.json`

Este archivo maneja la solapa **Auspiciantes** de la app de LU32.

Se edita acá, se pushea a `master`, y en ~5 minutos está en todos los celulares.
**No hace falta actualizar la app ni pasar por la tienda.**

> **Ojo:** hoy el archivo tiene UNA entrada de ejemplo (la propia radio), puesta
> sólo para poder verificar que la sección funciona. Reemplazala por los
> auspiciantes reales.

## Reglas que no se pueden romper

### 1. Los enlaces NO son URLs. Son el nombre de usuario.

Esto es lo que más se confunde. La app arma la URL sola.

| Campo | Qué se escribe | Qué abre la app |
|---|---|---|
| `instagram` | `fravega` | El perfil de Instagram |
| `facebook` | `fravega` | La página de Facebook |
| `whatsapp` | `+54 9 3764 123456` | El chat de WhatsApp |
| `phone` | `+54 9 3764 123456` | El discador del teléfono |
| `address` | `Av. Mitre 1234, Oberá` | El mapa en esa dirección |
| `website` | `https://www.fravega.com` | **Este SÍ es la URL completa** |

Si pegás la URL entera de Instagram, la app igual se da cuenta y saca el nombre
de usuario. Pero lo correcto es poner sólo el nombre.

**Por qué es así:** este archivo vive en un repo público y lo que dice termina
abriendo cosas en el teléfono de la gente. Como la app arma la URL, lo peor que
puede pasar con un error acá es que un botón lleve al Instagram equivocado.

### 2. `logoUrl` y `website` tienen que empezar con `https://`

Con `http://` (sin la s) el celular lo bloquea y el logo queda como un cuadro
vacío. Un auspiciante sin un `logoUrl` válido **no aparece**.

### 3. `pos` decide el orden, y conviene numerar de a 10

`pos` es el lugar en la grilla: el número más chico va primero.

**Numerá 10, 20, 30, 40...** ¿Por qué con huecos? Porque si mañana querés meter
uno nuevo entre el segundo y el tercero, le ponés `25` y listo — **una sola
edición**. Si numerás 1, 2, 3, 4 tenés que correr a todos los de abajo.

No hace falta que sean consecutivos ni que empiecen en 1.
Un auspiciante sin `pos` va al final.

### 4. `id` no se repite y no se cambia

El `id` es con lo que se cuentan las visitas que la app le manda a cada comercio.
Si lo cambiás, se pierde el historial de ese auspiciante.
Si se repite, el segundo no aparece.

## Campos

**Obligatorios** — sin uno de estos, el auspiciante no se muestra:

- `id` — identificador corto, sin espacios ni acentos: `veterinaria-del-centro`
- `name` — cómo se ve en la app: `Veterinaria del Centro`
- `logoUrl` — el logo, en `https://`

**Opcionales** — poné sólo los que el comercio realmente tenga. Los que falten
simplemente no muestran botón. **Nunca dejes un campo vacío para "rellenar"**.

- `pos`, `description`, `website`, `instagram`, `facebook`, `whatsapp`, `phone`, `address`

## Ejemplo completo

```json
{
  "sponsors": [
    {
      "id": "veterinaria-del-centro",
      "pos": 10,
      "name": "Veterinaria del Centro",
      "logoUrl": "https://algun-hosting/veterinaria.png",
      "description": "Atención y alimentos balanceados",
      "whatsapp": "+54 9 3764 654321",
      "instagram": "veterinariadelcentro",
      "address": "San Martín 456, Oberá, Misiones"
    },
    {
      "id": "panaderia-la-esquina",
      "pos": 20,
      "name": "Panadería La Esquina",
      "logoUrl": "https://algun-hosting/panaderia.png",
      "phone": "+54 3764 445566"
    }
  ]
}
```

## Sobre los logos

Se ven sobre un fondo **azul muy oscuro**. La app les pone un recuadro claro
detrás para que ninguno desaparezca, pero lo mejor sigue siendo un **PNG
cuadrado**, más o menos del mismo tamaño para todos, así la grilla queda pareja.

## Antes de pushear

Pegá el contenido en <https://jsonlint.com> y fijate que diga *Valid JSON*.

Un error de coma no rompe nada: la app ignora el archivo y sigue mostrando los
auspiciantes que ya tenía. Pero el cambio nuevo no va a aparecer hasta que se
arregle.

## Si querés dejar la sección vacía

`{ "sponsors": [] }` es válido y la app muestra "Todavía no hay auspiciantes".

Eso es **distinto** de un archivo roto: un archivo roto se ignora y quedan los
auspiciantes anteriores. Una lista vacía sí se aplica.
