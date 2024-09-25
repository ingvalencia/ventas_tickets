import React, { useState } from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';

const DateRangeForm = () => {
    const [local, setLocal] = useState('');
    const [fechaInicial, setFechaInicial] = useState('');
    const [fechaFinal, setFechaFinal] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validación de fechas
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
            // Aquí va la lógica para manejar la consulta
            Swal.fire({
                icon: 'success',
                title: 'Consulta realizada',
                text: `Local: ${local}, Fecha Inicial: ${fechaInicial}, Fecha Final: ${fechaFinal}`,
            });
        }
    };

    return (
        <Form onSubmit={handleSubmit}>
            <Row className="align-items-center">
                <Col md={3}>
                    <Form.Group controlId="localSelect">
                        <Form.Label>Local</Form.Label>
                        <Form.Control as="select" value={local} onChange={(e) => setLocal(e.target.value)}>
                            <option value="">Seleccione un local</option>
                            <option value="Local 1">Local 1</option>
                            <option value="Local 2">Local 2</option>
                        </Form.Control>
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
    );
};

export default DateRangeForm;
