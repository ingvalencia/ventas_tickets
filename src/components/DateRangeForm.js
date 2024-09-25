import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, Table } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import ReactPaginate from 'react-paginate';
import './customStyles.css'; // Para los estilos adicionales

const DateRangeForm = () => {
    const [local, setLocal] = useState('');
    const [locales, setLocales] = useState([]);
    const [fechaInicial, setFechaInicial] = useState('');
    const [fechaFinal, setFechaFinal] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [currentPage, setCurrentPage] = useState(0);
    const itemsPerPage = 10;
    const [searchTerm, setSearchTerm] = useState('');

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
                    console.error(data.error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.error,
                    });
                }
            } catch (error) {
                console.error('Error fetching locales:', error);
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
                        tipo: 'consultar_ventas',
                        cef: local,
                        feci: fechaInicial,
                        fecf: fechaFinal
                    }),
                });

                const data = await response.json();
                if (data.success === 1) {
                    setResults(data.data);
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

    const handleDownload = (format) => {
        let content = '';
        if (format === 'csv') {
            content += 'Cef,Fecha Vta,Imp Vtas,Imp Ticket cointech,Diferencia vtas vs tic coint,Imp tick sub,Imp tickets faltan,Suma ticketa falt+ cointech,Difere tic sub fal menos coint,Factura,Importe Factura global,Fecha real factura\n';
            results.forEach(result => {
                content += `${result.Cef},${formatFecha(result.Fecha_Vta)},${result.Imp_Vtas},${result.Imp_Ticket_cointech},${result.Diferencia_vtas_vs_tic_coint},${result.imp_tick_sub},${result.Imp_tickets_faltan},${result.Suma_ticketa_falt_cointech},${result.Difere_tic_sub_fal_menos_coint},${result.Factura},${result.Importe_Factura_global},${formatFecha(result.fecha_real_factura)}\n`;
            });
        } else if (format === 'txt') {
            content += 'Cef,Fecha Vta,Imp Vtas,Imp Ticket cointech,Diferencia vtas vs tic coint,Imp tick sub,Imp tickets faltan,Suma ticketa falt+ cointech,Difere tic sub fal menos coint,Factura,Importe Factura global,Fecha real factura\n';
            results.forEach(result => {
                content += `${result.Cef},${formatFecha(result.Fecha_Vta)},${result.Imp_Vtas},${result.Imp_Ticket_cointech},${result.Diferencia_vtas_vs_tic_coint},${result.imp_tick_sub},${result.Imp_tickets_faltan},${result.Suma_ticketa_falt_cointech},${result.Difere_tic_sub_fal_menos_coint},${result.Factura},${result.Importe_Factura_global},${formatFecha(result.fecha_real_factura)}\n`;
            });
        }
        
        const fileName = local === 'TODOS' ? `cef_totales_${formatFecha(new Date())}` : `${local}_${formatFecha(new Date())}`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.${format}`;
        link.click();
    };
    

    // Filtrar los resultados por el término de búsqueda
    const filteredResults = results.filter(result =>
        Object.values(result).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    // Controlar el cambio de página
    const handlePageClick = (selectedPage) => {
        setCurrentPage(selectedPage.selected);
    };

    // Filtrar los resultados para la página actual
    const currentResults = filteredResults.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

    return (
        <>
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

            {results.length > 0 && (
                <>
                    <Form.Group controlId="search">
                        <Form.Label>Buscar</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="Buscar por CEF, Factura o Fecha..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </Form.Group>
                    <p>Total de registros consultados: {filteredResults.length} registros</p>
                    <Button variant="secondary" onClick={() => {
                        Swal.fire({
                            title: 'Seleccione el formato de descarga',
                            showDenyButton: true,
                            showCancelButton: true,
                            confirmButtonText: 'CSV',
                            denyButtonText: 'TXT',
                        }).then((result) => {
                            if (result.isConfirmed) {
                                handleDownload('csv');
                            } else if (result.isDenied) {
                                handleDownload('txt');
                            }
                        });
                    }}>
                        Descargar Registros
                    </Button>
                </>
            )}

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
                                    <th>Cef</th>
                                    <th>Fecha Vta</th>
                                    <th>Imp Vtas</th>
                                    <th>Imp Ticket cointech</th>
                                    <th>Diferencia vtas vs tic coint</th>
                                    <th>Imp tick sub</th>
                                    <th>Imp tickets faltan</th>
                                    <th>Suma ticketa falt+ cointech</th>
                                    <th>Difere tic sub fal menos coint</th>
                                    <th>Factura</th>
                                    <th>Importe Factura global</th>
                                    <th>Fecha real factura</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentResults.map((result, index) => (
                                    <tr key={index}>
                                        <td>{result.Cef}</td>
                                        <td>{formatFecha(result.Fecha_Vta)}</td>
                                        <td>{result.Imp_Vtas}</td>
                                        <td>{result.Imp_Ticket_cointech}</td>
                                        <td>{result.Diferencia_vtas_vs_tic_coint}</td>
                                        <td>{result.imp_tick_sub}</td>
                                        <td>{result.Imp_tickets_faltan}</td>
                                        <td>{result.Suma_ticketa_falt_cointech}</td>
                                        <td>{result.Difere_tic_sub_fal_menos_coint}</td>
                                        <td>{result.Factura}</td>
                                        <td>{result.Importe_Factura_global}</td>
                                        <td>{formatFecha(result.fecha_real_factura)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>

                        <ReactPaginate
                            previousLabel={"Anterior"}
                            nextLabel={"Siguiente"}
                            breakLabel={"..."}
                            pageCount={Math.ceil(filteredResults.length / itemsPerPage)}
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
        </>
    );
};

export default DateRangeForm;
