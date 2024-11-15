import React from 'react';
import DateRangeForm from './components/DateRangeForm';
import Header from './components/Header';
import OtrosReportes from './components/OtrosReportes';
import CargaGlobal from './components/cargaGlobales';
import Cancelaciones from './components/cancelacion'; 
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'; 
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
    return (
        <Router basename="/diniz/ventas-tickets/">
            <Header />
            <div className="container">
                <Routes>
                    <Route exact path="/" element={<DateRangeForm />} />
                    <Route path="/otros-reportes" element={<OtrosReportes />} />
                    <Route path="/carga-globales" element={<CargaGlobal />} />
                    <Route path="/cancelaciones" element={<Cancelaciones />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
