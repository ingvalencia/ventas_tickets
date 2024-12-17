import React from 'react';
import { Navbar, Container, Nav, Form, Button } from 'react-bootstrap';
import { FaTicketAlt } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';

const Header = () => {
    const navigate = useNavigate();

    const handleSelectChange = (event) => {
        const selectedValue = event.target.value;
        if (selectedValue) {
            navigate(selectedValue);
        }
    };

    const goSalir = () => {
        localStorage.removeItem('sessionID');
        window.location.replace('https://diniz.com.mx');
    };

    return (
        <Navbar style={{ backgroundColor: '#0d6efd' }} variant="dark" expand="lg" className="mb-4 p-3 shadow-sm">
            <Container>
                <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
                    <FaTicketAlt className="me-2" />
                    <h3 className="mb-0">Ventas Tickets CEF</h3>
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="navbarResponsive" />
                <Navbar.Collapse id="navbarResponsive">
                    <Nav className="ms-auto align-items-center">
                        <Form.Select
                            aria-label="Selecciona una opción"
                            onChange={handleSelectChange}
                            className="me-3"
                            style={{ width: '250px' }}
                        >
                            <option value="">Selecciona una opción</option>
                            <option value="/">Ventas Tickets CEF</option>
                            <option value="/otros-reportes">Cointech vs Factura Global</option>
                            <option value="/carga-globales">Carga Ticket Facturas Globales</option>
                            <option value="/cancelaciones">Cancelaciones y numero comprobante cero</option>
                        </Form.Select>

                        {/* Botón Cerrar Sesión completamente a la derecha */}
                        <div className="ms-auto align-items-rigth">
                            <Button
                                variant="danger"
                                style={{
                                    fontSize: '0.8rem',
                                    padding: '5px 10px',
                                }}
                                onClick={goSalir}
                            >
                                Cerrar Sesión
                            </Button>
                        </div>
                    </Nav>
                   
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default Header;
