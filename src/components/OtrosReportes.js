import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, Table } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import ReactPaginate from 'react-paginate';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FaFileExcel } from 'react-icons/fa';

const OtrosReportes = () => {
    const [local, setLocal] = useState('');
    const [locales, setLocales] = useState([]);
    const [fechaInicial, setFechaInicial] = useState('');
    const [fechaFinal, setFechaFinal] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [currentPage, setCurrentPage] = useState(0);
    const itemsPerPage = 50;

    // Formatear fecha para YYYY-MM-DD
    const formatFecha = (fecha) => {
        const date = new Date(fecha);
        return date.toISOString().split('T')[0];
    };

    // Llamada al backend para obtener los locales
    useEffect(() => {
        const fetchLocales = async () => {
            try {
                const response = await fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ tipo: 'obtener_locales' }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.success === 1) {
                    const options = [{ value: "TODOS", label: "TODOS" }, 
                        ...data.locales.map((loc) => ({
                        value: loc.sigla,
                        label: `${loc.sigla}`,
                    }))];
                    setLocales(options);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.error,
                    });
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al obtener los locales o la respuesta no es válida.',
                });
            }
        };

        fetchLocales();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (new Date(fechaFinal) < new Date(fechaInicial)) {
            Swal.fire({
                icon: 'error',
                title: 'Error en las fechas',
                text: 'La Fecha Final no puede ser menor que la Fecha Inicial',
            });
            return;
        }

        if (local === '' || fechaInicial === '' || fechaFinal === '') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Todos los campos son obligatorios',
            });
        } else {
            setIsLoading(true);
            setResults([]);

            try {
                const response = await fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tipo: 'consultar_ventas_otros_reportes',
                        cef: local,
                        feci: fechaInicial,
                        fecf: fechaFinal
                    }),
                });

                const data = await response.json();
                if (data.success === 1) {
                    setResults(data.data);
                    setCurrentPage(0); // Resetear a la primera página cuando se hace una nueva búsqueda
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.error,
                    });
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al realizar la consulta',
                });
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Lógica de paginación: seleccionar los registros de la página actual
    const currentResults = results.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

    // Controlador del cambio de página
    const handlePageClick = ({ selected }) => {
        setCurrentPage(selected);
    };

    // Función para generar el archivo Excel
   
    const handleDownloadExcel = () => {
        const workbook = new ExcelJS.Workbook();
        //const worksheet = workbook.addWorksheet('Reporte Ventas');
        const worksheetName = local === 'TODOS' 
        ? `TODOS` 
        : `${local}`;

        const worksheet = workbook.addWorksheet(worksheetName);

      
        // Definir los encabezados con estilos
        worksheet.columns = [
          { header: 'CEF', key: 'cef', width: 15 },
          { header: 'Fecha', key: 'fecha', width: 15 },
          { header: 'Venta Real Cointech', key: 'vtas_real', width: 15 },
          { header: 'Importe Fac Global', key: 'imp_global', width: 15 },
          { header: 'Diferencia', key: 'Diferencia', width: 15 },
        ];
      
        // Aplicar estilo a los encabezados
        worksheet.getRow(1).eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '0000FF' }, // Fondo azul
          };
          cell.font = { color: { argb: 'FFFFFF' }, bold: true }; // Texto blanco
          cell.alignment = { horizontal: 'center' };
        });
      
        // Agregar datos y aplicar formato condicional
        results.forEach((result, index) => {
          const row = worksheet.addRow({
            cef: result.cef,
            fecha: formatFecha(result.fecha),
            vtas_real: result.vtas_real,
            imp_global: result.imp_global,
            Diferencia: result.Diferencia,
          });
      
          // Formato condicional para la columna Diferencia
          const diferenciaCell = row.getCell(5); // La columna "Diferencia" es la 5
          const diferencia = parseFloat(result.Diferencia);
      
          if (diferencia >= 2000) {
            row.eachCell((cell) => {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'f5d033' }, // Verde pistache
              };
            });
          } else if (diferencia <= -2000) {
            row.eachCell((cell) => {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFA07A' }, // Naranja melón
              };
            });
          }
        });
      
        // Generar el archivo Excel y descargarlo
        workbook.xlsx.writeBuffer().then((buffer) => {
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const fileName = local === 'TODOS' 
            ? `reporte_ventas_TODOS_${formatFecha(new Date())}` 
            : `reporte_ventas_${local}_${formatFecha(new Date())}`;

            saveAs(blob, `${fileName}.xlsx`);

        });
      };

      
      // Supongamos que el valor de `cef` está disponible en cada fila
      const handleFechaClick = (fecha) => {
        Swal.fire({
            title: `Selecciona el tipo de reporte para la fecha: ${formatFecha(fecha)}`,
            html: `
                <div style="display: flex; justify-content: space-around; margin-top: 20px;">
                    <button id="ventaReal" class="swal2-confirm swal2-styled" style="background-color: #007bff; color: white; padding: 10px 20px; border-radius: 5px; font-size: 14px; display: flex; align-items: center; width: 180px;">
                        <i class="fas fa-file-excel" style="margin-right: 10px;"></i> Reporte Venta Real Cointech
                    </button>
                    <button id="importeFacGlobal" class="swal2-deny swal2-styled" style="background-color: #dc3545; color: white; padding: 10px 20px; border-radius: 5px; font-size: 14px; display: flex; align-items: center; width: 180px;">
                        <i class="fas fa-file-excel" style="margin-right: 10px;"></i> Reporte Importe Fac Global
                    </button>
                    <button id="ambos" class="swal2-cancel swal2-styled" style="background-color: #6c757d; color: white; padding: 10px 20px; border-radius: 5px; font-size: 14px; display: flex; align-items: center; width: 180px;">
                        <i class="fas fa-file-excel" style="margin-right: 10px;"></i> Descargar Ambos
                    </button>
                </div>
            `,
            showConfirmButton: false,
            width: '600px',
            didOpen: () => {
                document.getElementById('ventaReal').addEventListener('click', () => {
                    handleDownloadCointechReport('AAA', formatFecha(fecha)); // Reporte Venta Real Cointech
                });
                document.getElementById('importeFacGlobal').addEventListener('click', () => {
                    handleDownloadImporteFacGlobalReport('AAA', formatFecha(fecha)); // Aquí llamamos al nuevo reporte
                });
                document.getElementById('ambos').addEventListener('click', () => {
                    handleDownloadBothReports('AAA', formatFecha(fecha)); // Pasar el valor correcto de CEF y fecha
                });
                
            }
        });
    };
    
    
    //Eventos de descarga:
    // Función para manejar la descarga de "Reporte Venta Real Cointech"
    const handleDownloadCointechReport = async (cef, fecha) => {
        Swal.fire({
            title: 'Procesando...',
            text: 'Por favor, espere mientras se genera el archivo.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const response = await fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tipo: 'reporte_venta_real',
                    cef: cef,
                    fecha: fecha,
                }),
            });

            const data = await response.json();

            if (data.success === 1) {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet(`Reporte ${cef}`);

                worksheet.columns = [
                    { header: 'CEF', key: 'cef', width: 15 },
                    { header: 'Fecha Vta', key: 'fecha_vta', width: 15 },
                    { header: 'ID Transacción', key: 'id_transaccion', width: 15 },
                    { header: 'Hora', key: 'hora', width: 15 },
                    { header: 'Número Terminal', key: 'numero_terminal', width: 15 },
                    { header: 'Número Comprobante', key: 'numero_comprobante', width: 20 },
                    { header: 'Importe Vta', key: 'importe_vta', width: 15 },
                ];

                worksheet.getRow(1).eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: '0000FF' }, // Fondo azul
                    };
                    cell.font = { color: { argb: 'FFFFFF' }, bold: true }; // Texto blanco y en negritas
                    cell.alignment = { horizontal: 'center' };
                });

                data.data.forEach((row) => {
                    worksheet.addRow(row);
                });

                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                saveAs(blob, `reporte_venta_real_${cef}_${fecha}.xlsx`);

                Swal.close();
                Swal.fire('Éxito', 'El archivo ha sido descargado', 'success');
            } else {
                Swal.close();
                Swal.fire('Error', 'No se pudo generar el reporte', 'error');
            }
        } catch (error) {
            Swal.close();
            Swal.fire('Error', 'Hubo un problema con la solicitud', 'error');
        }
    };

    const handleDownloadImporteFacGlobalReport = async (cef, fecha) => {
        const fechaFormateada = formatFecha(fecha);

        Swal.fire({
            title: 'Procesando...',
            text: 'Por favor, espere mientras se genera el archivo.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    
        try {
            const response = await fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tipo: 'reporte_importe_fac_global',
                    cef: cef,
                    fecha: fechaFormateada, // Utilizamos la fecha formateada aquí
                }),
            });
    
            const data = await response.json();
    
            if (data.success === 1) {
                // Generar el archivo Excel con los datos obtenidos
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet(`Reporte Importe Fac Global ${cef}`);
    
                // Definir los encabezados de la tabla con estilos
                worksheet.columns = [
                    { header: 'CEF', key: 'cef', width: 15 },
                    { header: 'Fecha Vta', key: 'fecha_vta', width: 15 },
                    { header: 'Fecha Facturado', key: 'fecha_factura', width: 15 },
                    { header: 'No Comprobante', key: 'numero_comprobante', width: 20 },
                    { header: 'RefID', key: 'REFID', width: 15 },
                    { header: 'Estatus', key: 'estatus', width: 15 },
                    { header: 'Sub total', key: 'sub_total', width: 15 },
                    { header: 'Descuento', key: 'descuento', width: 15 },
                    { header: 'Importe total', key: 'importe_total', width: 15 },
                    { header: 'Serie y Folio factura', key: 'folio_factura', width: 20 },
                    { header: 'Uuid Global', key: 'uuid_global', width: 25 },
                    { header: 'Fecha y hora Expedición', key: 'fecha_expedicion', width: 20 },
                    { header: 'Periodicidad Global', key: 'periodicidad', width: 15 },
                    { header: 'Mes Global', key: 'mes_global', width: 15 },
                    { header: 'Año Global', key: 'año_global', width: 15 },
                ];
    
                // Aplicar estilos a los encabezados (fondo azul y letras blancas)
                worksheet.getRow(1).eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: '0000FF' }, // Fondo azul
                    };
                    cell.font = { color: { argb: 'FFFFFF' }, bold: true }; // Texto blanco y en negritas
                    cell.alignment = { horizontal: 'center' }; // Centrado
                });
    
                // Agregar los datos al archivo Excel
                data.data.forEach((row) => {
                    worksheet.addRow({
                        cef: row.cef,
                        fecha_vta: formatFecha(row.fecha_vta), // Convertimos a objeto Date
                        fecha_factura: formatFecha(row.fecha_factura), // Convertimos a objeto Date
                        numero_comprobante: row.numero_comprobante,
                        REFID: row.REFID,
                        estatus: row.estatus,
                        sub_total: row.sub_total,
                        descuento: row.descuento,
                        importe_total: row.importe_total,
                        folio_factura: row.folio_factura,
                        uuid_global: row.uuid_global,
                        fecha_expedicion: formatFecha(row.fecha_expedicion), // Convertimos a objeto Date
                        periodicidad: row.periodicidad,
                        mes_global: row.mes_global,
                        año_global: row.año_global,
                    });
                });
                
                // Aplicar formato solo de fecha (sin hora) a las columnas de fechas
                worksheet.getColumn('fecha_vta').numFmt = 'yyyy-mm-dd';
                worksheet.getColumn('fecha_factura').numFmt = 'yyyy-mm-dd';
                worksheet.getColumn('fecha_expedicion').numFmt = 'yyyy-mm-dd';
                
    
                // Guardar el archivo
                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                saveAs(blob, `reporte_importe_fac_global_${cef}_${fechaFormateada}.xlsx`);
                
                Swal.close();
                Swal.fire('Éxito', 'El archivo ha sido descargado', 'success');
            } else {
                Swal.close();
                Swal.fire('Error', 'No se pudo generar el reporte', 'error');
            }
        } catch (error) {
            Swal.close();
            Swal.fire('Error', 'Hubo un problema con la solicitud', 'error');
        }
    };

    const handleDownloadBothReports = async (cef, fecha) => {

        Swal.fire({
            title: 'Procesando...',
            text: 'Por favor, espere mientras se genera el archivo.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            // Realizar las dos solicitudes para obtener los datos de ambos reportes
            const [ventaRealResponse, facGlobalResponse] = await Promise.all([
                fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tipo: 'reporte_venta_real',
                        cef: cef,
                        fecha: fecha,
                    }),
                }),
                fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tipo: 'reporte_importe_fac_global',
                        cef: cef,
                        fecha: fecha,
                    }),
                })
            ]);
    
            // Convertir las respuestas a JSON
            const ventaRealData = await ventaRealResponse.json();
            const facGlobalData = await facGlobalResponse.json();
    
            if (ventaRealData.success === 1 && facGlobalData.success === 1) {
                // Crear un nuevo archivo Excel con dos pestañas (hojas)
                const workbook = new ExcelJS.Workbook();
                
                // Pestaña 1: "Reporte Venta Real Cointech"
                const worksheetVentaReal = workbook.addWorksheet('Venta Real Cointech');
                worksheetVentaReal.columns = [
                    { header: 'CEF', key: 'cef', width: 15 },
                    { header: 'Fecha Vta', key: 'fecha_vta', width: 15 },
                    { header: 'ID Transacción', key: 'id_transaccion', width: 15 },
                    { header: 'Hora', key: 'hora', width: 15 },
                    { header: 'Número Terminal', key: 'numero_terminal', width: 15 },
                    { header: 'Número Comprobante', key: 'numero_comprobante', width: 20 },
                    { header: 'Importe Vta', key: 'importe_vta', width: 15 },
                ];
    
                // Aplicar formato a los encabezados
                worksheetVentaReal.getRow(1).eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: '0000FF' }, // Fondo azul
                    };
                    cell.font = { color: { argb: 'FFFFFF' }, bold: true }; // Texto blanco
                    cell.alignment = { horizontal: 'center' };
                });
    
                // Agregar datos a la primera pestaña
                ventaRealData.data.forEach((row) => {
                    worksheetVentaReal.addRow({
                        cef: row.cef,
                        fecha_vta: formatFecha(row.fecha_vta), // Aplicamos tu función para dar formato a la fecha
                        id_transaccion: row.id_transaccion,
                        hora: row.hora,
                        numero_terminal: row.numero_terminal,
                        numero_comprobante: row.numero_comprobante,
                        importe_vta: row.importe_vta
                    });
                });
    
                // Pestaña 2: "Reporte Importe Fac Global"
                const worksheetFacGlobal = workbook.addWorksheet('Importe Fac Global');
                worksheetFacGlobal.columns = [
                    { header: 'CEF', key: 'cef', width: 15 },
                    { header: 'Fecha Vta', key: 'fecha_vta', width: 15 },
                    { header: 'Fecha Facturado', key: 'fecha_factura', width: 15 },
                    { header: 'No Comprobante', key: 'numero_comprobante', width: 20 },
                    { header: 'RefID', key: 'REFID', width: 15 },
                    { header: 'Estatus', key: 'estatus', width: 15 },
                    { header: 'Sub total', key: 'sub_total', width: 15 },
                    { header: 'Descuento', key: 'descuento', width: 15 },
                    { header: 'Importe total', key: 'importe_total', width: 15 },
                    { header: 'Serie y Folio factura', key: 'folio_factura', width: 20 },
                    { header: 'Uuid Global', key: 'uuid_global', width: 25 },
                    { header: 'Fecha y hora Expedición', key: 'fecha_expedicion', width: 20 },
                    { header: 'Periodicidad Global', key: 'periodicidad', width: 15 },
                    { header: 'Mes Global', key: 'mes_global', width: 15 },
                    { header: 'Año Global', key: 'año_global', width: 15 },
                ];
    
                // Aplicar formato a los encabezados de la segunda pestaña
                worksheetFacGlobal.getRow(1).eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: '0000FF' }, // Fondo azul
                    };
                    cell.font = { color: { argb: 'FFFFFF' }, bold: true }; // Texto blanco
                    cell.alignment = { horizontal: 'center' };
                });
    
                // Agregar datos a la segunda pestaña
                facGlobalData.data.forEach((row) => {
                    worksheetFacGlobal.addRow({
                        cef: row.cef,
                        fecha_vta: formatFecha(row.fecha_vta), // Convertimos a objeto Date
                        fecha_factura: formatFecha(row.fecha_factura), // Convertimos a objeto Date
                        numero_comprobante: row.numero_comprobante,
                        REFID: row.REFID,
                        estatus: row.estatus,
                        sub_total: row.sub_total,
                        descuento: row.descuento,
                        importe_total: row.importe_total,
                        folio_factura: row.folio_factura,
                        uuid_global: row.uuid_global,
                        fecha_expedicion: formatFecha(row.fecha_expedicion).toLocaleString(), // Convertimos a objeto Date
                        periodicidad: row.periodicidad,
                        mes_global: row.mes_global,
                        año_global: row.año_global,
                    });
                });
    
                // Descargar el archivo Excel con las dos pestañas
                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                saveAs(blob, `reporte_combinado_${cef}_${fecha}.xlsx`);
                
                Swal.close();
                Swal.fire('Éxito', 'El archivo combinado ha sido descargado', 'success');
            } else {
                Swal.close();
                Swal.fire('Error', 'No se pudieron generar ambos reportes', 'error');
            }
        } catch (error) {
            Swal.close();
            Swal.fire('Error', 'Hubo un problema con la solicitud', 'error');
        }
    };
    
    return (
        <div className="container mt-4">
            <h1>Otros Reportes</h1>
            <Form onSubmit={handleSubmit}>
                <Row className="align-items-center">
                    <Col md={3}>
                        <Form.Group controlId="localSelect">
                            <Form.Label>Local</Form.Label>
                            <Select 
                                options={locales} 
                                onChange={(selectedOption) => setLocal(selectedOption ? selectedOption.value : '')}
                                placeholder="Seleccione un local..."
                                isClearable={true}
                                isSearchable={true} 
                            />
                        </Form.Group>
                    </Col>
                    <Col md={3}>
                        <Form.Group controlId="fechaInicial">
                            <Form.Label>Fecha Inicial</Form.Label>
                            <Form.Control 
                                type="date" 
                                value={fechaInicial} 
                                onChange={(e) => setFechaInicial(e.target.value)} 
                            />
                        </Form.Group>
                    </Col>
                    <Col md={3}>
                        <Form.Group controlId="fechaFinal">
                            <Form.Label>Fecha Final</Form.Label>
                            <Form.Control 
                                type="date" 
                                value={fechaFinal} 
                                onChange={(e) => setFechaFinal(e.target.value)} 
                            />
                        </Form.Group>
                    </Col>
                    <Col md={2} className="d-flex align-items-end">
                        <Button variant="primary" type="submit" className="mt-2">
                            Consultar
                        </Button>
                    </Col>
                </Row>
            </Form>

            {isLoading ? (
                <div className="text-center mt-4">
                    <div className="spinner-border" role="status">
                        <span className="sr-only">Loading...</span>
                    </div>
                </div>
            ) : (
                results.length > 0 && (
                    <>
                    <Table striped bordered hover responsive className="mt-4">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>CEF</th>
                                <th>Fecha</th>
                                <th>Venta Real Cointech</th>
                                <th>Importe Fac Global</th>
                                <th>Diferencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentResults.map((result, index) => (
                                <tr key={index}>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#f5d033'
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a'
                                                : 'transparent'
                                        }}
                                    >
                                        {index + 1 + currentPage * itemsPerPage}
                                    </td>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#f5d033'
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a'
                                                : 'transparent'
                                        }}
                                    >
                                        {result.cef}
                                    </td>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#f5d033'
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a'
                                                : 'transparent'
                                        }}
                                    >
                                        <td>
                                            <a href="#" onClick={() => handleFechaClick(formatFecha(result.fecha), result.cef)}>
                                            {formatFecha(result.fecha)}
                                            </a>
                                        </td>

                                    </td>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#f5d033'
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a'
                                                : 'transparent'
                                        }}
                                    >
                                        {result.vtas_real}
                                    </td>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#f5d033'
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a'
                                                : 'transparent'
                                        }}
                                    >
                                        {result.imp_global}
                                    </td>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#f5d033'
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a'
                                                : 'transparent'
                                        }}
                                    >
                                        {parseFloat(result.Diferencia).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>

                    {/* Botón para descargar Excel */}
                    <Button variant="success" onClick={handleDownloadExcel} className="d-flex align-items-center">
                        <FaFileExcel size={20} style={{ marginRight: '8px' }} /> {/* Icono Excel */}
                        Descargar Excel
                    </Button>

                    <ReactPaginate
                        previousLabel={"Anterior"}
                        nextLabel={"Siguiente"}
                        breakLabel={"..."}
                        pageCount={Math.ceil(results.length / itemsPerPage)}
                        marginPagesDisplayed={2}
                        pageRangeDisplayed={5}
                        onPageChange={handlePageClick}
                        containerClassName={"pagination justify-content-center"}
                        activeClassName={"active"}
                        previousClassName={"page-item"}
                        nextClassName={"page-item"}
                        pageClassName={"page-item"}
                        breakClassName={"page-item"}
                        previousLinkClassName={"page-link"}
                        nextLinkClassName={"page-link"}
                        pageLinkClassName={"page-link"}
                        breakLinkClassName={"page-link"}
                    />
                    </>
                )
            )}
        </div>
    );
};

export default OtrosReportes;
