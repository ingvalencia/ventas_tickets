import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, Table } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import ReactPaginate from 'react-paginate';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FaFileExcel } from 'react-icons/fa';
import { FaFileUpload } from "react-icons/fa";
import { FaFileAlt } from "react-icons/fa";

import * as XLSX from 'xlsx';

const CargaGlobal = () => {
    const [showMainView, setShowMainView] = useState(false);
    const [local, setLocal] = useState('');
    const [locales, setLocales] = useState([]);
    const [fechaInicial, setFechaInicial] = useState('');
    const [fechaFinal, setFechaFinal] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 50;

     // Formatear fecha para YYYY-MM-DD
     const formatFecha = (fecha) => {
        const date = new Date(fecha);
        return date.toISOString().split('T')[0];
    };

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

    const handleConsultarClick = () => {
        setShowMainView(true);
    };

    
    //INICIO
    const handleSubirClick = () => {
        Swal.fire({
            title: 'Subir Reporte de Tickets',
            html: `
                <p style="font-size: 1.1rem; color: #333;">
                    Seleccione el archivo generado por <b>CSFacturacion</b> para cargarlo.
                </p>
                <small style="display: block; margin-top: 7px; color: #777;">
                    Solo se permiten archivos en formato .xlsx y hasta 1 GB de tamaño.
                </small>
            `,
            input: 'file',
            inputAttributes: {
                'accept': '.xlsx',
                'aria-label': 'Sube tu archivo de reporte de tickets'
            },
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-upload"></i> Subir Reporte',
            cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-outline-secondary'
            },
            buttonsStyling: false,
            preConfirm: async (archivo) => {
                if (!archivo) {
                    Swal.showValidationMessage('Por favor, selecciona un archivo');
                    return false;
                }
    
                const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024; // Tamaño máximo de archivo: 1 GB
                if (archivo.size > MAX_FILE_SIZE) {
                    Swal.showValidationMessage('El archivo es demasiado grande. Máximo 1 GB');
                    return false;
                }
    
                // Paso 1: Detectar fechas máxima y mínima
                const fechas = await obtenerFechasDelArchivo(archivo);
                if (!fechas) return false; // Si falla, detener el flujo
    
                // Paso 2: Llamar al backend para eliminar registros
                const eliminacionExitosa = await eliminarRegistros(fechas.fechaMin, fechas.fechaMax);
                if (!eliminacionExitosa) return false;
    
                // Paso 3: Procesar y cargar archivo en fragmentos
                return procesarYSubirArchivoEnFragmentos(archivo);
            },
            icon: 'info',
        });
    };

    const obtenerFechasDelArchivo = async (archivo) => {
        try {
            Swal.fire({
                title: 'Procesando archivo...',
                text: 'Detectando fechas máxima y mínima...',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => Swal.showLoading()
            });
    
            const data = await archivo.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
            const fechas = jsonData.map((row) => row['FCH/HR VENTA']?.split(' ')[0]).filter(Boolean);
            const fechaMin = fechas.reduce((min, cur) => (cur < min ? cur : min), fechas[0]);
            const fechaMax = fechas.reduce((max, cur) => (cur > max ? cur : max), fechas[0]);
    
            Swal.close();
            return { fechaMin, fechaMax };
        } catch (error) {
            Swal.fire('Error', 'No se pudieron detectar las fechas del archivo.', 'error');
            console.error(error);
            return null;
        }
    };

    const eliminarRegistros = async (fechaMin, fechaMax) => {
        try {
            Swal.fire({
                title: 'Eliminando registros...',
                html: `<p>Rango de fechas: <strong>${fechaMin}</strong> a <strong>${fechaMax}</strong></p>
                       <div style="width: 100%; background-color: #f3f3f3; border-radius: 5px; height: 20px;">
                           <div id="progress-bar-delete" style="width: 0%; background-color: #4caf50; height: 100%; border-radius: 5px;"></div>
                       </div>`,
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => Swal.showLoading()
            });
    
            const response = await fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'elimina_registros_carga_global',
                    fechaMin,
                    fechaMax
                })
            });
    
            const result = await response.json();
    
            if (result.success !== 1) {
                // Mostrar mensaje de error específico si viene del backend
                Swal.fire({
                    title: 'Error al eliminar registros',
                    html: `<p>${result.error || 'Ocurrió un error desconocido.'}</p>`,
                    icon: 'error',
                    confirmButtonText: 'Aceptar'
                });
                return false;
            }
    
            // Mostrar mensaje de éxito por 5 segundos
            Swal.fire({
                title: 'Éxito',
                html: `<p>${result.message}</p>`,
                icon: 'success',
                timer: 5000,
                timerProgressBar: true,
                showConfirmButton: false
            });
    
            await new Promise((resolve) => setTimeout(resolve, 5000)); // Pausa de 5 segundos
    
            // Mostrar SweetAlert de "Procesando..."
            Swal.fire({
                title: 'Procesando...',
                html: '<p>Preparando la carga de fragmentos...</p>',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => Swal.showLoading()
            });
    
            return true;
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
            console.error(error);
            return false;
        }
    };
    
    
    

    const subirFragmento = async (archivo, fragmentoNumero, totalFragmentos) => {
        const formData = new FormData();
        formData.append('archivo', archivo);
        formData.append('tipo', 'subir_reporte_ticket_fragmento');
        formData.append('fragmentoNumero', fragmentoNumero);
        formData.append('totalFragmentos', totalFragmentos);
    
        try {
            const response = await fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                method: 'POST',
                body: formData,
            });
    
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
    
            const data = await response.json();
            if (data.success !== 1) {
                throw new Error(data.error || 'Error desconocido');
            }
    
            return data; // Devuelve la respuesta en caso de éxito
        } catch (error) {
            console.error(`Error al procesar el fragmento ${fragmentoNumero}:`, error);
            return null; // Devuelve null en caso de error
        }
    };
    

    const procesarYSubirArchivoEnFragmentos = async (archivo) => {
        const CHUNK_SIZE = 10000;
        const data = await archivo.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        const totalRecords = jsonData.length;
        const totalChunks = Math.ceil(totalRecords / CHUNK_SIZE);
    
        let processedRecords = 0;
        let insertedRecords = 0;
        let errorRecords = [];
    
        // Mostrar alerta SweetAlert para el progreso
        Swal.fire({
            title: 'Cargando archivo...',
            html: `
                <div style="width: 100%; background-color: #f3f3f3; border-radius: 5px; height: 20px;">
                    <div id="progress-bar" style="width: 0%; background-color: #4caf50; height: 100%; border-radius: 5px;"></div>
                </div>
                <p id="progress-text" style="margin-top: 10px;">Procesando 0%</p>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => Swal.showLoading()
        });
    
        for (let i = 0; i < totalChunks; i++) {
            const chunkData = jsonData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            const csvBlob = new Blob([JSON.stringify(chunkData)], { type: 'application/json' });
            const csvFile = new File([csvBlob], `reporte_fragmento_${i + 1}.json`, { type: 'application/json' });
    
            const result = await subirFragmento(csvFile, i + 1, totalChunks);
    
            if (result && result.success) {
                processedRecords += result.processed || 0;
                insertedRecords += result.inserted || 0;
    
                const errors = Array.isArray(result.error_details) ? result.error_details : [];
                errorRecords.push(...errors);
            } else {
                Swal.fire('Error', `Hubo un problema al subir el fragmento ${i + 1}`, 'error');
                return;
            }
    
            // Actualizar barra de progreso
            const progress = Math.floor(((i + 1) / totalChunks) * 100);
            const progressBar = document.getElementById('progress-bar');
            const progressText = document.getElementById('progress-text');
    
            if (progressBar && progressText) {
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `Procesando ${progress}%`;
            }
        }
    
        Swal.close();
    
        // Mostrar resultados del proceso
        Swal.fire(
            'Resultado del Proceso',
            `
                Registros en el archivo: ${totalRecords}
                Registros procesados: ${processedRecords}
                Registros insertados: ${insertedRecords}
                Registros con errores: ${errorRecords.length}
                Detalles de errores: ${errorRecords.join('\n')}
            `,
            processedRecords === totalRecords && insertedRecords === totalRecords ? 'success' : 'warning'
        );
    };
    
    
    
    
    
    

    // FIN
   

    const handleRegresarClick = () => {
        setShowMainView(false);
        setLocal('');
        setFechaInicial('');
        setFechaFinal('');
        setResults([]);
    };

    // Función para manejar la consulta de datos
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
            fetchPageData(0); // Iniciar en la primera página
        }
    };

    // Función para obtener datos paginados
        const fetchPageData = async (page) => {
        setIsLoading(true);
        setResults([]); // Limpiar resultados previos mientras se carga
        try {
            const response = await fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tipo: 'consultar_carga_global',
                    cef: local,
                    feci: fechaInicial,
                    fecf: fechaFinal,
                    page: page + 1,
                    pageSize: itemsPerPage,
                }),
            });

            const data = await response.json();
            if (data.success === 1) {
                if (data.data.length === 0) {
                    // Mostrar alerta si no hay datos
                    Swal.fire({
                        icon: 'info',
                        title: 'Sin resultados',
                        text: 'No hay registros para el rango de fechas seleccionado.',
                    });
                } else {
                    setResults(data.data); // Actualizar los resultados para mostrarlos en la tabla
                    setTotalItems(data.total); // Actualizar el total de elementos para la paginación
                    setCurrentPage(page); // Actualizar la página actual
                }
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
            setIsLoading(false); // Finalizar el estado de carga
        }
    };


    const handlePageClick = ({ selected }) => {
        fetchPageData(selected);
    };

    // Función para descargar el Excel completo
    const handleDownloadExcel = async () => {
        Swal.fire({
            title: 'Procesando...',
            text: 'Por favor, espere mientras se genera el archivo.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    
        let allData = [];
        let start = 0;
        const limit = 5000;
        let hasMoreData = true;
    
        while (hasMoreData) {
            try {
                const response = await fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tipo: 'descargar_carga_global',
                        cef: local,
                        feci: fechaInicial,
                        fecf: fechaFinal,
                        start: start,
                        limit: limit
                    }),
                });
    
                const data = await response.json();
                if (data.success === 1) {
                    allData = allData.concat(data.data);
                    start += limit;
                    hasMoreData = data.data.length === limit;
                } else {
                    Swal.close();
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Error al obtener todos los registros para la descarga.',
                    });
                    return;
                }
            } catch (error) {
                Swal.close();
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al realizar la descarga de datos.',
                });
                return;
            }
        }
    
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Carga Global');
        worksheet.columns = [
            { header: 'Fecha Hora Vigencia', key: 'fecha_hora_vigencia', width: 20 },
            { header: 'Fecha Hora Venta', key: 'fecha_hora_vta', width: 20 },
            { header: 'Fecha Recepción', key: 'fecha_recepcion', width: 20 },
            { header: 'REFID', key: 'REFID', width: 15 },
            { header: 'Estatus', key: 'ESTATUS', width: 15 },
            { header: 'SERIE', key: 'SERIE', width: 15 },
            { header: 'Subtotal', key: 'SUBTOTAL', width: 15 },
            { header: 'Descuento', key: 'DESCUENTO', width: 15 },
            { header: 'IVA', key: 'IVA', width: 15 },
            { header: 'IEPS Traslado 6%', key: 'ieps_trasladp_6', width: 20 },
            { header: 'IEPS Traslado 8%', key: 'ieps_traslado_8', width: 20 },
            { header: 'IEPS Traslado 0.265%', key: 'ieps_tralado_0_265', width: 20 },
            { header: 'IEPS Traslado 0.53%', key: 'ieps_tralado_0_53', width: 20 },
            { header: 'Otros IEPS', key: 'otros_ieps', width: 15 },
            { header: 'Total', key: 'TOTAL', width: 15 },
            { header: 'Folio Factura Ingreso', key: 'Folio_Fctura_Ingreso', width: 25 },
            { header: 'UUID Factura Ingreso', key: 'UUI_factura_Ingreso', width: 25 },
            { header: 'Fecha Expedición Factura Ingreso', key: 'fecha_expedición_Factura_Ingreso', width: 30 },
            { header: 'Folio Factura Egreso', key: 'Folio_Factura_egreso_Si_existe', width: 25 },
            { header: 'UUID Factura Egreso', key: 'uuid_Factura_Egreso_Si_existe', width: 25 },
            { header: 'Fecha Expedición Factura Egreso', key: 'fecha_expedición_Factura_Egreso_Si_existe', width: 30 },
            { header: 'Folio Global', key: 'Folio_Global_Si_existe', width: 20 },
            { header: 'UUID Global', key: 'uuid_Global_Si_existe', width: 25 },
            { header: 'Fecha Expedición Factura Global', key: 'fecha_expedición_Factura_Global', width: 30 },
            { header: 'Periodicidad Global', key: 'Periodicidad_Global', width: 20 },
            { header: 'Mes Global', key: 'Mes_Global', width: 15 },
            { header: 'Año Global', key: 'Año_Global', width: 15 },
            { header: 'Fecha Venta', key: 'Fecha_vta', width: 20 },
            { header: 'Fecha Factura', key: 'Fecha_factura', width: 20 },
            { header: 'Número Comprobante', key: 'numero_comprobante', width: 20 }
        ];
    
        worksheet.getRow(1).eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '0000FF' }
            };
            cell.font = { color: { argb: 'FFFFFF' }, bold: true };
            cell.alignment = { horizontal: 'center' };
        });
    
        // Modificación: aplicar `formatFecha` antes de agregar cada registro
        allData.forEach((record) => {
            // Aplicamos la función formatFecha a las fechas específicas
            record.Fecha_vta = formatFecha(record.Fecha_vta);
            record.Fecha_factura = formatFecha(record.Fecha_factura);
            
            worksheet.addRow(record);
        });
    
        try {
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `reporte_carga_global.xlsx`);
            Swal.close();
            Swal.fire('Éxito', 'El archivo ha sido descargado', 'success');
        } catch (error) {
            Swal.close();
            Swal.fire('Error', 'Hubo un problema al generar el archivo.', 'error');
        }
    };
    

    if (!showMainView) {
        return (
            <div className="container mt-4 text-center">
                <h3 style={{ fontWeight: 'bold', color: '#333' }}>Carga Tickets Facturas Globales</h3>
                <br />
                <div className="d-flex justify-content-center align-items-center mt-4">
                    <Button
                        variant="warning"
                        className="mx-3 custom-button custom-button-white"
                        onClick={handleConsultarClick}
                        style={{ backgroundImage: 'linear-gradient(135deg, #FFC107, #FF9800)' }}
                    >
                        <FaFileAlt size={25} style={{ marginRight: '8px' }} /> Consultar carga tickets globales
                    </Button>
                    <Button
                        variant="info"
                        className="mx-3 custom-button custom-button-info custom-button-white"
                        onClick={handleSubirClick}
                    >
                        <FaFileUpload size={25} style={{ marginRight: '8px' }} /> Subir tickets globales
                    </Button>
                </div>
            </div>


        );
    }

    return (
        <div className="container mt-4">
            <h5>Consulta Carga Ticket Facturas Globales</h5>
            <br />
            <Form onSubmit={handleSubmit}>
                <Row className="align-items-center">
                    <Col md={3}>
                        <Form.Group controlId="localSelect">
                            <Form.Label>Local</Form.Label>
                            <Select
                                options={locales}
                                onChange={(selectedOption) => setLocal(selectedOption ? selectedOption.value : '')}
                                placeholder="Seleccione un local..."
                                isClearable
                                isSearchable
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
                        <Button variant="secondary" onClick={handleRegresarClick} className="mt-2 ms-2">
                            Regresar
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
                                <th>Fecha Hora Vigencia</th>
                                <th>Fecha Hora Venta</th>
                                <th>Fecha Recepción</th>
                                <th>REFID</th>
                                <th>Estatus</th>
                                <th>SERIE</th>
                                <th>Subtotal</th>
                                <th>Descuento</th>
                                <th>IVA</th>
                                <th>IEPS Traslado 6%</th>
                                <th>IEPS Traslado 8%</th>
                                <th>IEPS Traslado 0.265%</th>
                                <th>IEPS Traslado 0.53%</th>
                                <th>Otros IEPS</th>
                                <th>Total</th>
                                <th>Folio Factura Ingreso</th>
                                <th>UUID Factura Ingreso</th>
                                <th>Fecha Expedición Factura Ingreso</th>
                                <th>Folio Factura Egreso</th>
                                <th>UUID Factura Egreso</th>
                                <th>Fecha Expedición Factura Egreso</th>
                                <th>Folio Global</th>
                                <th>UUID Global</th>
                                <th>Fecha Expedición Factura Global</th>
                                <th>Periodicidad Global</th>
                                <th>Mes Global</th>
                                <th>Año Global</th>
                                <th>Fecha Venta</th>
                                <th>Fecha Factura</th>
                                <th>Número Comprobante</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((result, index) => (
                                <tr key={index}>
                                    <td>{index + 1 + currentPage * itemsPerPage}</td>
                                    <td>{result.fecha_hora_vigencia}</td>
                                    <td>{result.fecha_hora_vta}</td>
                                    <td>{result.fecha_recepcion}</td>
                                    <td>{result.REFID}</td>
                                    <td>{result.ESTATUS}</td>
                                    <td>{result.SERIE}</td>
                                    <td>{result.SUBTOTAL}</td>
                                    <td>{result.DESCUENTO}</td>
                                    <td>{result.IVA}</td>
                                    <td>{result.ieps_trasladp_6}</td>
                                    <td>{result.ieps_traslado_8}</td>
                                    <td>{result.ieps_tralado_0_265}</td>
                                    <td>{result.ieps_tralado_0_53}</td>
                                    <td>{result.otros_ieps}</td>
                                    <td>{result.TOTAL}</td>
                                    <td>{result.Folio_Fctura_Ingreso}</td>
                                    <td>{result.UUI_factura_Ingreso}</td>
                                    <td>{result.fecha_expedición_Factura_Ingreso}</td>
                                    <td>{result.Folio_Factura_egreso_Si_existe}</td>
                                    <td>{result.uuid_Factura_Egreso_Si_existe}</td>
                                    <td>{result.fecha_expedición_Factura_Egreso_Si_existe}</td>
                                    <td>{result.Folio_Global_Si_existe}</td>
                                    <td>{result.uuid_Global_Si_existe}</td>
                                    <td>{result.fecha_expedición_Factura_Global}</td>
                                    <td>{result.Periodicidad_Global}</td>
                                    <td>{result.Mes_Global}</td>
                                    <td>{result.Año_Global}</td>
                                    <td>{formatFecha(result.Fecha_vta)}</td>
                                    <td>{formatFecha(result.Fecha_factura)}</td>
                                    <td>{result.numero_comprobante}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>

                    <Button variant="success" onClick={handleDownloadExcel} className="d-flex align-items-center">
                        <FaFileExcel size={20} style={{ marginRight: '8px' }} /> Descargar Excel
                    </Button>

                    <ReactPaginate
                        previousLabel={"Anterior"}
                        nextLabel={"Siguiente"}
                        breakLabel={"..."}
                        pageCount={Math.ceil(totalItems / itemsPerPage)}
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

export default CargaGlobal;
