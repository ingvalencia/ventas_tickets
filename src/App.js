import React from 'react';
import DateRangeForm from './components/DateRangeForm';
import Header from './components/Header';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
    return (
        <div>
            <Header />
            <div className="container">
                <DateRangeForm />
            </div>
        </div>
    );
}

export default App;
