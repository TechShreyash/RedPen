import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ResultsPage from './pages/ResultsPage';
import ScanResultsPage from './pages/ScanResultsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/results/:id" element={<ResultsPage />} />
        <Route path="/scan/:id" element={<ScanResultsPage />} />
      </Routes>
    </Router>
  );
}

export default App;
