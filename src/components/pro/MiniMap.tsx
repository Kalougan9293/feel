import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Place } from '../../data/places'
import 'leaflet/dist/leaflet.css'
import './MiniMap.css'

const PARIS: [number, number] = [48.8566, 2.3522]

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: 'greedy',
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#f3ebe3' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#5c534a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#faf7f2' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#ebe0d4' }],
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#d9cbb8' }],
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#d6e4ee' }],
    },
  ],
}

type Props = {
  places: Place[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** false quand le panneau est masqué (mobile Liste) — force un invalidateSize Leaflet */
  active?: boolean
}

function createPin(active: boolean) {
  return L.divIcon({
    className: '',
    html: `<span class="mini-pin${active ? ' is-active' : ''}"><span class="mini-pin__halo"></span><span class="mini-pin__dot"></span></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

/** Carte démo Leaflet + OSM (sans clé) en attendant Google Maps */
function FakeMap({ places, selectedId, onSelect, active = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: PARIS,
      zoom: 11,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      subdomains: 'abc',
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    mapRef.current = map

    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(containerRef.current)

    requestAnimationFrame(() => map.invalidateSize())

    return () => {
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!active) return
    const map = mapRef.current
    if (!map) return
    requestAnimationFrame(() => {
      map.invalidateSize()
      if (selectedId) {
        const place = places.find((p) => p.id === selectedId)
        if (place) map.panTo([place.lat, place.lng], { animate: false })
      }
    })
  }, [active, selectedId, places])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const nextIds = new Set(places.map((p) => p.id))

    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    places.forEach((place) => {
      const existing = markersRef.current.get(place.id)
      const active = place.id === selectedId

      if (existing) {
        existing.setLatLng([place.lat, place.lng])
        existing.setIcon(createPin(active))
        existing.setZIndexOffset(active ? 1000 : 0)
        return
      }

      const marker = L.marker([place.lat, place.lng], {
        icon: createPin(active),
        riseOnHover: true,
        zIndexOffset: active ? 1000 : 0,
      }).addTo(map)

      marker.on('click', () => onSelectRef.current(place.id))
      markersRef.current.set(place.id, marker)
    })
  }, [places, selectedId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const place = places.find((p) => p.id === selectedId)
    if (!place) return
    map.panTo([place.lat, place.lng], { animate: true, duration: 0.45 })
  }, [selectedId, places])

  return (
    <div className="mini-map mini-map--leaflet">
      <div ref={containerRef} className="mini-map__canvas" />
    </div>
  )
}

function LiveMap({ places, selectedId, onSelect }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string
  const [map, setMap] = useState<google.maps.Map | null>(null)

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'studio-google-maps',
    googleMapsApiKey: apiKey,
  })

  const selected = useMemo(
    () => places.find((p) => p.id === selectedId) ?? null,
    [places, selectedId],
  )

  useEffect(() => {
    if (!map || !selected) return
    map.panTo({ lat: selected.lat, lng: selected.lng })
  }, [map, selected])

  if (loadError) {
    return <FakeMap places={places} selectedId={selectedId} onSelect={onSelect} />
  }

  if (!isLoaded) {
    return <div className="mini-map mini-map--loading">Chargement de la carte…</div>
  }

  return (
    <div className="mini-map">
      <GoogleMap
        mapContainerClassName="mini-map__canvas"
        center={selected ? { lat: selected.lat, lng: selected.lng } : { lat: PARIS[0], lng: PARIS[1] }}
        zoom={selected ? 13 : 11}
        options={MAP_OPTIONS}
        onLoad={setMap}
        onUnmount={() => setMap(null)}
      >
        {places.map((place) => {
          const active = place.id === selectedId
          return (
            <MarkerF
              key={place.id}
              position={{ lat: place.lat, lng: place.lng }}
              title={place.name}
              onClick={() => onSelect(place.id)}
              zIndex={active ? 10 : 1}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: active ? 9 : 7,
                fillColor: active ? '#c45a7a' : '#e11d2e',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
            />
          )
        })}
      </GoogleMap>
    </div>
  )
}

export function MiniMap(props: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

  if (!apiKey) {
    return <FakeMap {...props} />
  }

  return <LiveMap places={props.places} selectedId={props.selectedId} onSelect={props.onSelect} />
}
