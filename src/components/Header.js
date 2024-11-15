import React from 'react';
import { Navbar, Container, Nav, Form } from 'react-bootstrap';
import { FaFileAlt, FaTicketAlt, FaFileUpload } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';

const Header = () => {
    const navigate = useNavigate();  // Hook para redirigir a las rutas

    const handleSelectChange = (event) => {
        const selectedValue = event.target.value;
        if (selectedValue) {
            navigate(selectedValue);  // Redirigir a la ruta seleccionada
        }
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
                    <Nav className="ms-auto">
                        {/* Convertimos los enlaces de navegación en un input select */}
                        <Form.Select 
                            aria-label="Selecciona una opción" 
                            onChange={handleSelectChange} 
                            className="ms-auto"
                        >
                            <option value="">Selecciona una opción</option>
                            <option value="/"> 
                                Ventas Tickets CEF
                            </option>
                            <option value="/otros-reportes"> 
                                Cointech vs Factura Global
                            </option>
                            <option value="/carga-globales"> 
                                Carga Ticket Facturas Globales
                            </option>
                        </Form.Select>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default Header;
