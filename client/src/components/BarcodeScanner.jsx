import { useZxing } from "react-zxing";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

/**
 * Shared Barcode Scanner Component
 * Reusable across admin and user interfaces
 */
export function Scanner({ onScan, onClose }) {
    const { ref } = useZxing({
        onResult(result) {
            onScan(result.getText());
        },
        options: {
            hints: new Map([
                [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE]]
            ])
        }
    });

    return (
        <div style={{ marginBottom: '2rem', background: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
            <video ref={ref} style={{ width: '100%', display: 'block' }} />
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'red', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px', zIndex: 10 }}
            >
                Cerrar
            </button>
            <p style={{ color: 'white', textAlign: 'center', padding: '0.5rem', position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.5)' }}>
                Apuntando a Código de Barras (ICCID)
            </p>
        </div>
    );
}
