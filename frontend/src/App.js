import React, { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Layers, AlertCircle, Map as MapIcon, SlidersHorizontal, Sparkles } from 'lucide-react';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import GuidedTour, { TOUR_STEPS } from './components/GuidedTour';
import RouteForm from './components/RouteForm';
import RouteCard from './components/RouteCard';
import MapView from './components/MapView';
import WeatherTimeline from './components/WeatherTimeline';
import LoadingOverlay from './components/LoadingOverlay';
import { calculateRoutes, fetchWeatherHeatmap, checkHealth } from './api/routeApi';
import './App.css';

function App() {
  // Navigation view: 'landing' (creative overview) | 'app' (dispatcher console)
  const [viewMode, setViewMode] = useState('landing');

  // Guided demo tour state
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Mobile layout switcher tab: 'form' | 'map'
  const [mobileTab, setMobileTab] = useState('form');

  // Route & Heatmap data
  const [routesData, setRoutesData] = useState(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [forecastHour, setForecastHour] = useState(0);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapData, setHeatmapData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);

  const [lastSearchParams, setLastSearchParams] = useState({
    origin: 'Chicago, IL',
    destination: 'Denver, CO',
    load_weight: 42000,
    departure_datetime: new Date().toISOString(),
    sampling_interval_miles: 25,
  });

  // Check backend server status
  const checkStatus = useCallback(async () => {
    const isHealthy = await checkHealth();
    setBackendOnline(isHealthy);
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Handle route planning submission
  const handleRouteSubmit = async (params) => {
    setIsLoading(true);
    setLastSearchParams(params);

    try {
      // Parallel fetch of routes and corridor heatmap
      const [routeResult, heatmapResult] = await Promise.all([
        calculateRoutes(params),
        fetchWeatherHeatmap({
          origin: params.origin,
          destination: params.destination,
          load_weight: params.load_weight,
          hours: 48,
        }),
      ]);

      setRoutesData(routeResult);
      setHeatmapData(heatmapResult);

      const recommendedIdx = routeResult.recommendation?.recommended_route_index ?? 0;
      setSelectedRouteIndex(recommendedIdx);
      setForecastHour(0);

      // On mobile, automatically switch to map tab to show results
      if (window.innerWidth < 1024) {
        setMobileTab('map');
      }

      toast.success(
        `Safest route found: ${routeResult.recommendation?.recommended_route_name || 'Route 1'}`,
        {
          icon: '🛡️',
          duration: 4500,
          style: {
            background: '#12121a',
            color: '#e2e8f0',
            border: '1px solid #22c55e',
            boxShadow: '0 8px 24px rgba(34, 197, 94, 0.25)',
          },
        }
      );
    } catch (err) {
      console.error('Error fetching routes:', err);
      toast.error(err.message || 'Failed to calculate routes. Please check inputs and try again.', {
        duration: 5000,
        style: {
          background: '#12121a',
          color: '#fca5a5',
          border: '1px solid #ef4444',
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Demo Trigger
  const handleRunDemo = () => {
    setViewMode('app');
    handleRouteSubmit({
      origin: 'Chicago, IL',
      destination: 'Denver, CO',
      departure_datetime: new Date().toISOString(),
      load_weight: 42000,
      sampling_interval_miles: 25,
    });
  };

  // Tour handlers
  const handleStartTour = () => {
    setViewMode('app');
    setTourStep(0);
    setIsTourOpen(true);
  };

  const handleNextTourStep = () => {
    setTourStep((prev) => Math.min(prev + 1, TOUR_STEPS.length - 1));
  };

  const handlePrevTourStep = () => {
    setTourStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinishAndRun = () => {
    setIsTourOpen(false);
    handleRunDemo();
  };

  const routes = routesData?.routes || [];
  const recommendation = routesData?.recommendation || {};
  const recommendedIndex = recommendation.recommended_route_index ?? 0;

  return (
    <div className="spotter-app">
      <Toaster position="top-right" />

      {/* Global Header */}
      <Header
        backendOnline={backendOnline}
        currentView={viewMode}
        onSwitchView={setViewMode}
        onOpenTour={handleStartTour}
      />

      {/* Landing Page View */}
      {viewMode === 'landing' && (
        <LandingPage
          onLaunchApp={() => setViewMode('app')}
          onStartTour={handleStartTour}
          onRunDemo={handleRunDemo}
        />
      )}

      {/* Route Console View */}
      {viewMode === 'app' && (
        <div className="app-console-wrapper">
          {/* Mobile Tab Switcher (<1024px) */}
          <div className="mobile-layout-tabs">
            <button
              className={`mobile-tab-btn ${mobileTab === 'form' ? 'active' : ''}`}
              onClick={() => setMobileTab('form')}
            >
              <SlidersHorizontal size={15} />
              <span>Trip & Routes {routes.length > 0 ? `(${routes.length})` : ''}</span>
            </button>
            <button
              className={`mobile-tab-btn ${mobileTab === 'map' ? 'active' : ''}`}
              onClick={() => setMobileTab('map')}
            >
              <MapIcon size={15} />
              <span>Interactive Map</span>
              {routes.length > 0 && <span className="tab-pill">Live</span>}
            </button>
          </div>

          <main className="app-main-layout">
            {/* Left Control & Routes Panel */}
            <aside className={`app-sidebar ${mobileTab === 'form' ? 'mobile-visible' : 'mobile-hidden'}`}>
              <div className="sidebar-scrollable-content">
                {/* Input Form */}
                <RouteForm onSubmit={handleRouteSubmit} isLoading={isLoading} />

                {/* Generated Routes Header & Cards */}
                <div className="routes-results-container" id="tour-step-routes">
                  <div className="results-header">
                    <div className="results-title-group">
                      <Layers size={16} className="results-icon" />
                      <h3 className="results-title">Calculated Routes ({routes.length})</h3>
                    </div>
                    {routes.length > 0 && (
                      <span className="results-count-badge">
                        {lastSearchParams.origin} → {lastSearchParams.destination}
                      </span>
                    )}
                  </div>

                  {routes.length === 0 && !isLoading && (
                    <div className="empty-routes-state">
                      <AlertCircle size={26} className="empty-icon" />
                      <p className="empty-title">No routes analyzed yet</p>
                      <p className="empty-subtitle">
                        Configure origin, destination, and cargo weight above, then click &quot;Find Safest Route&quot;.
                      </p>
                      <button
                        className="empty-quick-demo-btn"
                        onClick={handleRunDemo}
                      >
                        <Sparkles size={14} />
                        <span>Run Chicago → Denver Demo</span>
                      </button>
                    </div>
                  )}

                  {/* Stacked Route Cards */}
                  <div className="route-cards-stack">
                    {routes.map((route) => {
                      const isRec = route.route_index === recommendedIndex;
                      const isSel = route.route_index === selectedRouteIndex;
                      const rankInfo = recommendation.rankings?.find(
                        (item) => item.route_index === route.route_index
                      );
                      const rank = rankInfo ? rankInfo.rank : route.route_index + 1;

                      return (
                        <RouteCard
                          key={`route-card-${route.route_index}`}
                          route={route}
                          isSelected={isSel}
                          isRecommended={isRec}
                          onSelect={() => {
                            setSelectedRouteIndex(route.route_index);
                            // On mobile, jump to map view when card is clicked
                            if (window.innerWidth < 1024) {
                              setMobileTab('map');
                            }
                          }}
                          rank={rank}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </aside>

            {/* Right Map & Heatmap Timeline View */}
            <section className={`app-map-section ${mobileTab === 'map' ? 'mobile-visible' : 'mobile-hidden'}`}>
              {isLoading && <LoadingOverlay />}

              <div className="map-container-area">
                <MapView
                  routes={routes}
                  selectedRouteIndex={selectedRouteIndex}
                  onSelectRoute={setSelectedRouteIndex}
                  recommendedRouteIndex={recommendedIndex}
                  recommendation={recommendation}
                  heatmapData={heatmapData}
                  forecastHour={forecastHour}
                  showHeatmap={showHeatmap}
                />
              </div>

              {/* Floating Weather Forecast Timeline */}
              <div className="timeline-docked-container" id="tour-step-timeline">
                <WeatherTimeline
                  hourOffset={forecastHour}
                  onChange={setForecastHour}
                  departureTime={lastSearchParams.departure_datetime}
                  showHeatmap={showHeatmap}
                  onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
                />
              </div>
            </section>
          </main>
        </div>
      )}

      {/* Interactive Guided Demo Tour */}
      {isTourOpen && (
        <GuidedTour
          currentStep={tourStep}
          onNext={handleNextTourStep}
          onPrev={handlePrevTourStep}
          onClose={() => setIsTourOpen(false)}
          onFinishAndRun={handleFinishAndRun}
          onChangeTab={setMobileTab}
        />
      )}
    </div>
  );
}

export default App;
