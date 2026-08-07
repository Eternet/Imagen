# Actualización de banners de medios locales

Esta primera versión prepara banners sin reemplazar ni publicar archivos activos.

## Fuente de verdad

`banner/banners.config.json` registra por medio:

- carpeta pública;
- formato requerido;
- dimensiones exactas;
- archivo activo histórico usado para auditar;
- nombre canónico futuro (`banner.mp4` o `banner.jpg`);
- plantilla de código correspondiente a la web.

Los valores se obtuvieron de los archivos actualmente referenciados. Deben revisarse con cada medio antes de habilitar publicación automática.

## Auditar el estado actual

```powershell
node scripts/banners.mjs audit
```

El comando no modifica archivos. Comprueba que el banner activo configurado exista, tenga el formato correcto y coincida exactamente con las dimensiones requeridas.

## Preparar una actualización

```powershell
node scripts/banners.mjs prepare `
  --media lvp `
  --input "C:\Creatividades\campana\lvp.mp4" `
  --campaign campana-agosto-2026 `
  --url "https://destino-confirmado.example" `
  --alt "Eternet: descripción confirmada de la campaña"
```

La salida queda en:

```text
banner/_prepared/campana-agosto-2026/lvp/
  banner.mp4
  codigo.txt
  manifest.json
```

`codigo.txt` es el único bloque vigente propuesto para ese medio. El manifiesto conserva la procedencia y los parámetros utilizados.

## Medios configurados

| ID | Formato | Dimensiones |
|---|---|---:|
| `caynet` | MP4 | 700 × 700 |
| `cazadores` | MP4 | 244 × 440 |
| `chaves-digital` | MP4 | 500 × 500 |
| `club-mitre` | MP4 | 400 × 400 |
| `el-fenix` | JPG | 450 × 450 |
| `fm-sol-juarez` | JPG | 500 × 500 |
| `lu24` | MP4 | 500 × 500 |
| `lvp` | MP4 | 303 × 250 |

## Seguridad

- No convierte ni recorta creatividades automáticamente.
- Rechaza dimensiones o formatos incorrectos.
- No reemplaza archivos activos.
- No elimina versiones históricas.
- No ejecuta commit, push ni despliegue.
- La URL y el texto alternativo deben proporcionarse explícitamente.

La publicación automática se incorporará recién después de validar este circuito con una campaña real.
