import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, Table } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import ReactPaginate from 'react-paginate';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FaFileExcel } from 'react-icons/fa';

const Cancelacion = () => {
    const [cef, setCef] = useState('');
    const [cefs, setCefs] = useState([]);
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
        const fetchCefs = async () => {
            try {
                const response = await fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tipo: 'obtener_locales' }),
                });

                const data = await response.json();
                if (data.success === 1) {
                    const options = [{ value: "TODOS", label: "TODOS" }, 
                        ...data.locales.map((loc) => ({
                        value: loc.sigla,
                        label: `${loc.sigla}`,
                    }))];
                    setCefs(options);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.error });
                }
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Error al obtener los locales.' });
            }
        };

        fetchCefs();
    }, []);

    // Manejo de consulta
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (new Date(fechaFinal) < new Date(fechaInicial)) {
            Swal.fire({ icon: 'error', title: 'Error en las fechas', text: 'La Fecha Final no puede ser menor que la Fecha Inicial' });
            return;
        }

        if (!cef || !fechaInicial || !fechaFinal) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Todos los campos son obligatorios' });
            return;
        }

        fetchPageData(0); // Iniciar en la primera página
    };

    // Función para obtener datos paginados
    const fetchPageData = async (page) => {
        setIsLoading(true);
        setResults([]);
        try {
            const response = await fetch('https://diniz.com.mx/diniz/servicios/services/ventas-tickets/controller.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'consultar_cancelaciones',
                    cef,
                    feci: fechaInicial,
                    fecf: fechaFinal,
                    page: page + 1,
                    pageSize: itemsPerPage,
                }),
            });

            const data = await response.json();
            if (data.success === 1) {
                setResults(data.data);
                setTotalItems(data.total);
                setCurrentPage(page);
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: data.error });
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Error al realizar la consulta' });
        } finally {
            setIsLoading(false);
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
            didOpen: () => Swal.showLoading(),
        });
    
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Cancelaciones');
        worksheet.columns = [
            { header: 'CEF', key: 'CEF', width: 15 },
            { header: 'Fecha', key: 'FECHA', width: 15 },
            { header: 'ID Transacción', key: 'ID_TRANSACCION', width: 20 },
            { header: 'Forma de Pago', key: 'FORMA_PAGO', width: 15 },
            { header: 'Número Terminal', key: 'NUMERO_TERMINAL', width: 20 },
            { header: 'Tipo', key: 'TIPO', width: 15 },
            { header: 'Número Comprobante', key: 'NUMERO_COMPROBANTE', width: 20 },
            { header: 'Importe', key: 'Importe', width: 15 },
        ];
    
        worksheet.getRow(1).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0000FF' } };
            cell.font = { color: { argb: 'FFFFFF' }, bold: true };
            cell.alignment = { horizontal: 'center' };
        });
    
        results.forEach((result, index) => {
            worksheet.addRow({
                CEF: result.CEF,
                FECHA: formatFecha(result.FECHA),
                ID_TRANSACCION: result.ID_TRANSACCION,
                FORMA_PAGO: result.FORMA_PAGO,
                NUMERO_TERMINAL: result.NUMERO_TERMINAL,
                TIPO: result.TIPO,
                NUMERO_COMPROBANTE: result.NUMERO_COMPROBANTE,
                Importe: result.Importe
            });
        });
    
        try {
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `cancelaciones.xlsx`);
            Swal.close();
            Swal.fire('Éxito', 'El archivo ha sido descargado', 'success');
        } catch (error) {
            Swal.close();
            Swal.fire('Error', 'Hubo un problema al generar el archivo.', 'error');
        }
    };

    return (
        <div className="container mt-4">
            <h5>Cancelaciones y Número Comprobante Cero</h5>
            <Form onSubmit={handleSubmit}>
                <Row className="align-items-center">
                    <Col md={3}>
                        <Form.Group controlId="cefSelect">
                            <Form.Label>CEF</Form.Label>
                            <Select options={cefs} onChange={(opt) => setCef(opt ? opt.value : '')} placeholder="Seleccione un CEF..." isClearable isSearchable />
                        </Form.Group>
                    </Col>
                    <Col md={3}>
                        <Form.Group controlId="fechaInicial">
                            <Form.Label>Fecha Inicial</Form.Label>
                            <Form.Control type="date" value={fechaInicial} onChange={(e) => setFechaInicial(e.target.value)} />
                        </Form.Group>
                    </Col>
                    <Col md={3}>
                        <Form.Group controlId="fechaFinal">
                            <Form.Label>Fecha Final</Form.Label>
                            <Form.Control type="date" value={fechaFinal} onChange={(e) => setFechaFinal(e.target.value)} />
                        </Form.Group>
                    </Col>
                    <Col md={2} className="d-flex align-items-end">
                        <Button variant="primary" type="submit" className="mt-2">Consultar</Button>
                    </Col>
                </Row>
            </Form>

            {isLoading ? (
                <div className="text-center mt-4">
                    <div className="spinner-border" role="status"><span className="sr-only">Loading...</span></div>
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
                                <th>ID Transacción</th>
                                <th>Forma de Pago</th>
                                <th>Número Terminal</th>
                                <th>Tipo</th>
                                <th>Número Comprobante</th>
                                <th>Importe</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((result, index) => (
                                <tr key={index}>
                                    <td>{index + 1 + currentPage * itemsPerPage}</td>
                                    <td>{result.CEF}</td>
                                    <td>{formatFecha(result.FECHA)}</td>
                                    <td>{result.ID_TRANSACCION}</td>
                                    <td>{result.FORMA_PAGO}</td>
                                    <td>{result.NUMERO_TERMINAL}</td>
                                    <td>{result.TIPO}</td>
                                    <td>{result.NUMERO_COMPROBANTE}</td>
                                    <td>{result.Importe}</td>
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

export default Cancelacion;
