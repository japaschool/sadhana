import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { yatrasApi } from '../../api/yatras'
import { isSameDay, toDateStr } from '../today/date'
import { useLogDate } from '../today/useLogDate'

const SELECTED_KEY = 'selected_yatra'

function readSelected(): string | null {
  try { return localStorage.getItem(SELECTED_KEY) } catch { return null }
}

/** The yatra list, the selected yatra (remembered across visits) and its data for the log's day. */
export function useYatras() {
  const qc = useQueryClient()
  const [date, setDate] = useLogDate()
  const cob = toDateStr(date)
  const [selectedId, setSelectedId] = useState(readSelected)

  const listQ = useQuery({ queryKey: ['yatras'], queryFn: yatrasApi.getYatras })
  const yatras = listQ.data ?? []
  const yatra = yatras.find((y) => y.id === selectedId) ?? yatras[0] ?? null

  const dataQ = useQuery({
    queryKey: ['yatra-data', yatra?.id, cob],
    queryFn: () => yatrasApi.getYatraData(yatra!.id, cob),
    enabled: !!yatra,
  })

  const select = (id: string) => {
    setSelectedId(id)
    try { localStorage.setItem(SELECTED_KEY, id) } catch { /* private mode: just not remembered */ }
  }

  const create = useMutation({
    mutationFn: yatrasApi.createYatra,
    onSuccess: (y) => { select(y.id); void qc.invalidateQueries({ queryKey: ['yatras'] }) },
  })

  return {
    yatras, yatra, select, create,
    date, setDate, isToday: isSameDay(date, new Date()),
    data: dataQ.data,
    isLoading: listQ.isLoading || dataQ.isLoading,
    isError: listQ.isError || dataQ.isError,
  }
}
