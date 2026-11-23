import { useEffect, useState } from 'react';
import type { SalesProjectBooking } from '../types';
import { getStoredBookings } from '../utils/salesCapacity';

/**
 * Live list of sales bookings. The list is kept in sync with the server by
 * salesBookingSync and every change fires 'talaei_sales_bookings_updated'.
 * (Reading it once in a useMemo kept old bookings on screen until something else changed.)
 */
export function useSalesBookings(): SalesProjectBooking[] {
  const [bookings, setBookings] = useState<SalesProjectBooking[]>(() => getStoredBookings());
  useEffect(() => {
    const refresh = () => setBookings(getStoredBookings());
    refresh();
    window.addEventListener('talaei_sales_bookings_updated', refresh);
    return () => window.removeEventListener('talaei_sales_bookings_updated', refresh);
  }, []);
  return bookings;
}
