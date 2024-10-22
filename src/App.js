import React from 'react';
import DateRangeForm from './components/DateRangeForm';
import Header from './components/Header';
import OtrosReportes from './components/OtrosReportes'; // Importa el nuevo componente
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'; // Usa Routes en lugar de Switch
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
    return (
        <Router>
            <Header />
            <div className="container">
                <Routes>
                    <Route exact path="/" element={<DateRangeForm />} /> {/* Mantén tu componente actual */}
                    <Route path="/otros-reportes" element={<OtrosReportes />} /> {/* Nueva página */}
                </Routes>
            </div>
        </Router>
    );
}

export default App;
