import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, Table } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import ReactPaginate from 'react-paginate';

const OtrosReportes = () => {
    const [local, setLocal] = useState('');
    const [locales, setLocales] = useState([]);
    const [fechaInicial, setFechaInicial] = useState('');
    const [fechaFinal, setFechaFinal] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [currentPage, setCurrentPage] = useState(0);
    const itemsPerPage = 50; // Registros por página

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
                        tipo: 'consultar_ventas_otros_reportes', // Nueva consulta para esta vista
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
                                <th>Venta Real</th>
                                <th>Importe Global</th>
                                <th>Diferencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentResults.map((result, index) => (
                                <tr key={index}>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#98fb98' // Verde pistache
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a' // Naranja melón
                                                : 'transparent'
                                        }}
                                    >
                                        {index + 1 + currentPage * itemsPerPage}
                                    </td>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#98fb98' // Verde pistache
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a' // Naranja melón
                                                : 'transparent'
                                        }}
                                    >
                                        {result.cef}
                                    </td>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#98fb98' // Verde pistache
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a' // Naranja melón
                                                : 'transparent'
                                        }}
                                    >
                                        {formatFecha(result.fecha)}
                                    </td>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#98fb98' // Verde pistache
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a' // Naranja melón
                                                : 'transparent'
                                        }}
                                    >
                                        {result.vtas_real}
                                    </td>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#98fb98' // Verde pistache
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a' // Naranja melón
                                                : 'transparent'
                                        }}
                                    >
                                        {result.imp_global}
                                    </td>
                                    <td
                                        style={{
                                            backgroundColor: parseFloat(result.Diferencia) >= 2000
                                                ? '#98fb98' // Verde pistache
                                                : parseFloat(result.Diferencia) <= -2000
                                                ? '#ffa07a' // Naranja melón
                                                : 'transparent'
                                        }}
                                    >
                                        {result.Diferencia}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>

                    {/* Paginación */}
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
