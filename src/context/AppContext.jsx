import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api/client'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [places, setPlaces] = useState([])
  const [events, setEvents] = useState([])
  const [banners, setBanners] = useState([])
  const [selectedCity, setSelectedCity] = useState('Харків')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [placesData, eventsData, bannersData] = await Promise.all([
        api.get('/places'),
        api.get('/events'),
        api.get('/banners'),
      ])
      setPlaces(placesData)
      setEvents(eventsData)
      setBanners(bannersData)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const addPlace = async (place) => {
    const created = await api.post('/places', place)
    setPlaces(prev => [...prev, created])
    return created
  }

  const updatePlace = async (id, data) => {
    const updated = await api.put(`/places/${id}`, data)
    setPlaces(prev => prev.map(p => p.id === id ? updated : p))
    return updated
  }

  const deletePlace = async (id) => {
    await api.delete(`/places/${id}`)
    setPlaces(prev => prev.filter(p => p.id !== id))
    setEvents(prev => prev.filter(e => e.placeId !== id))
  }

  const addEvent = async (event) => {
    const created = await api.post('/events', event)
    setEvents(prev => [...prev, created])
    return created
  }

  const updateEvent = async (id, data) => {
    const updated = await api.put(`/events/${id}`, data)
    setEvents(prev => prev.map(e => e.id === id ? updated : e))
    return updated
  }

  const deleteEvent = async (id) => {
    await api.delete(`/events/${id}`)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const addBanner = async (data) => {
    const created = await api.post('/banners', data)
    setBanners(prev => [...prev, created])
    return created
  }

  const updateBanner = async (id, data) => {
    const updated = await api.put(`/banners/${id}`, data)
    setBanners(prev => prev.map(b => b.id === id ? updated : b))
    return updated
  }

  const deleteBanner = async (id) => {
    await api.delete(`/banners/${id}`)
    setBanners(prev => prev.filter(b => b.id !== id))
  }

  const getPlaceEvents = (placeId) =>
    events.filter(e => e.placeId === placeId).sort((a, b) => a.date.localeCompare(b.date))

  const publishedPlaces = useMemo(() => places.filter(p => p.published), [places])

  const filteredPlaces = useMemo(() =>
    selectedCity === 'Усі міста'
      ? publishedPlaces
      : publishedPlaces.filter(p => p.city === selectedCity),
    [publishedPlaces, selectedCity]
  )

  return (
    <AppContext.Provider value={{
      places,
      events,
      banners,
      filteredPlaces,
      selectedCity,
      setSelectedCity,
      loading,
      reload: loadData,
      addPlace,
      updatePlace,
      deletePlace,
      addEvent,
      updateEvent,
      deleteEvent,
      addBanner,
      updateBanner,
      deleteBanner,
      getPlaceEvents,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
