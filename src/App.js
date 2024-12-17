import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import DateRangeForm from './components/DateRangeForm';
import Header from './components/Header';
import OtrosReportes from './components/OtrosReportes';
import CargaGlobal from './components/cargaGlobales';
import Cancelaciones from './components/cancelacion';
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';

function App() {
    // Método para identificar usuario
    const usuario_con = (numero) => {
        const data = { sesionid: numero };

        fetch('https://diniz.com.mx/diniz/servicios/services/pn_sesion_con2.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(DatosUsuario => {
            if (DatosUsuario[0]?.usuarios.noempl !== 'x') {
                localStorage.setItem('sessionID', DatosUsuario[0].usuarios.uniqueid);
                console.log("Usuario identificado:", DatosUsuario[0].usuarios);

                // Llama al método vip aquí para validar roles
                vip(DatosUsuario[0].usuarios.noempl);
            } else {
                goSalir();
            }
        })
        .catch(e => {
            console.error("Error al identificar usuario:", e);
            goSalir();
        });
    };

    // Método para validar roles del usuario
    const vip = (noempl) => {
        console.log("Entra a Vip");

        const API_URL = process.env.NODE_ENV === 'production'
            ? process.env.REACT_APP_API_URL_PROD
            : process.env.REACT_APP_API_URL_LOCAL;

        const url = `${API_URL}/controller.php`;
        const data = { tipo: "get_roles_empleados", noempl: noempl };

        console.log("url:", url);
        console.log("data:", data);

        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        })
        .then((response) => response.json())
        .then((data) => {
            if (!data.success) {
                
                Swal.fire({
                    icon: "error",
                    title: "Permiso Denegado",
                    text: "El usuario no tiene permisos.",
                    confirmButtonText: "Cerrar"
                }).then(() => {
                    goSalir(); // Cierra sesión después de mostrar el mensaje
                });
                return;
            }

            const noempl_vip = data["datos"]["rol1"].map(String);
            const noempl_edit = data["datos"]["rol2"].map(String);
            const rol_estatus = data["datos"]["rol3"].map(String);
            const numeroBuscado = String(noempl);

            if (rol_estatus.includes(numeroBuscado)) {
                Swal.fire({
                    icon: "warning",
                    title: "Sistema en mantenimiento",
                    text: "Regrese más tarde. Agradecemos su paciencia y comprensión.",
                    confirmButtonText: "Entendido"
                }).then(() => {
                    goSalir(); // Descomenta esto si quieres cerrar sesión después del aviso
                });
                return;
            }

            if (!noempl_vip.includes(numeroBuscado) &&
                !noempl_edit.includes(numeroBuscado)) {
                Swal.fire({
                    icon: "error",
                    title: "Permiso Denegado",
                    text: "El usuario no tiene acceso.",
                    confirmButtonText: "Cerrar"
                }).then(() => {
                    goSalir(); // Cierra sesión después de mostrar el mensaje
                });
                return;
            }

            const rol = noempl_vip.includes(numeroBuscado) ? 1 : 2;
            console.log("Rol del usuario:", rol);
        })
        .catch((error) => {
            console.error("Error al obtener el rol:", error);
            goSalir();
        });
    };

    // Método para cerrar sesión y redirigir
    const goSalir = () => {
        localStorage.removeItem('sessionID');
        window.location.replace('https://diniz.com.mx');
    };

    // Método para obtener parámetros de la URL
    const getQueryVariable = (variable) => {
        const query = window.location.search.substring(1); // Elimina el "?" inicial
        const vars = query.split("&"); // Divide la cadena en parámetros
        for (let i = 0; i < vars.length; i++) {
            const pair = vars[i].split("="); // Divide cada parámetro en clave y valor
            if (pair[0] === variable) {
                return pair[1]; // Devuelve el valor si encuentra la clave
            }
        }
        return false; // Devuelve false si no encuentra la clave
    };

    useEffect(() => {
        const sessionID = localStorage.getItem('sessionID') || getQueryVariable('id');
    
        if (process.env.NODE_ENV === 'production') {
            if (sessionID) {
                usuario_con(sessionID);
            } else {
                console.log("Sesión no encontrada, redirigiendo...");
                goSalir();
            }
        } else {
            // Entorno de desarrollo: fuerza el usuario de prueba
            console.log("Entorno actual: Desarrollo - Forzando sesión de prueba 42371");
            usuario_con('42371'); // Forzar validación con ID 42371
            vip('42371'); // Fuerza la entrada a VIP con 42371
        }
    }, []);
    


    return (
        <Router basename="VentasTickets/">
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
