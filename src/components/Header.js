import React from 'react';
import { Navbar, Container, Nav } from 'react-bootstrap';
import { FaFileAlt, FaTicketAlt } from 'react-icons/fa'; // Iconos opcionales

const Header = () => {
    return (
        <Navbar style={{ backgroundColor: '#0d6efd' }} variant="dark" expand="lg" className="mb-4 p-3 shadow-sm">
            <Container>
                <Navbar.Brand href="#" className="d-flex align-items-center">
                    <FaTicketAlt className="me-2" /> 
                    <h3 className="mb-0">Ventas Tickets CEF</h3>
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="navbarResponsive" />
                <Navbar.Collapse id="navbarResponsive">
                    <Nav className="ms-auto">
                        <Nav.Link href="/" className="d-flex align-items-center">
                            <FaTicketAlt className="me-1" /> Ventas Tickets CEF
                        </Nav.Link>
                        <Nav.Link href="/otros-reportes" className="d-flex align-items-center">
                            <FaFileAlt className="me-1" /> Otros Reportes
                        </Nav.Link>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default Header;
