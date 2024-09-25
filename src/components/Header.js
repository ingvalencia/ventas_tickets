import React from 'react';
import { Navbar, Container } from 'react-bootstrap';

const Header = () => {
    return (
        <Navbar bg="primary" variant="dark" className="mb-4">
            <Container>
                <Navbar.Brand className="mx-auto text-center">
                    <h2>Ventas Tickets CEF</h2>
                </Navbar.Brand>
            </Container>
        </Navbar>
    );
};

export default Header;
