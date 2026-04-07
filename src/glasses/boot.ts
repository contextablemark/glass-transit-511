/**
 * Glasses mode entry point.
 *
 * Each page shows one direction for one station.
 * Scroll to cycle pages, tap to refresh, double-tap to exit.
 */

import {
  CreateStartUpPageContainer,
  TextContainerProperty,
  RebuildPageContainer,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { getSettings } from '../lib/storage'
import {
  loadStations,
  currentPage,
  nextPage,
  prevPage,
  refreshCurrentArrivals,
  getState,
} from './stations'
import {
  renderHeader,
  renderBody,
  renderLoading,
  renderNoStations,
} from './display'
import { setupInput } from './input'

const HEADER_ID = 1
const HEADER_NAME = 'hdr'
const BODY_ID = 2
const BODY_NAME = 'body'

let bridge: EvenAppBridge | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null

// ── Display helpers ──

async function createInitialPage(
  headerText: string,
  bodyText: string
): Promise<void> {
  if (!bridge) return
  await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          xPosition: 0, yPosition: 0, width: 576, height: 28,
          borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
          containerID: HEADER_ID, containerName: HEADER_NAME,
          content: headerText, isEventCapture: 0,
        }),
        new TextContainerProperty({
          xPosition: 0, yPosition: 28, width: 576, height: 260,
          borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
          containerID: BODY_ID, containerName: BODY_NAME,
          content: bodyText, isEventCapture: 1,
        }),
      ],
    })
  )
}

async function rebuildDisplay(
  headerText: string,
  bodyText: string
): Promise<void> {
  if (!bridge) return
  await bridge.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          xPosition: 0, yPosition: 0, width: 576, height: 28,
          borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
          containerID: HEADER_ID, containerName: HEADER_NAME,
          content: headerText, isEventCapture: 0,
        }),
        new TextContainerProperty({
          xPosition: 0, yPosition: 28, width: 576, height: 260,
          borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
          containerID: BODY_ID, containerName: BODY_NAME,
          content: bodyText, isEventCapture: 1,
        }),
      ],
    })
  )
}

async function updateBody(text: string): Promise<void> {
  if (!bridge) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: BODY_ID, containerName: BODY_NAME,
      contentOffset: 0, contentLength: 2000, content: text,
    })
  )
}

async function updateHeader(text: string): Promise<void> {
  if (!bridge) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: HEADER_ID, containerName: HEADER_NAME,
      contentOffset: 0, contentLength: 1000, content: text,
    })
  )
}

// ── Display update logic ──

async function displayCurrentPage(useRebuild: boolean): Promise<void> {
  const page = currentPage()
  const { pages, currentIndex } = getState()
  const settings = await getSettings()

  if (!page) {
    if (useRebuild) {
      await rebuildDisplay('Glass Transit 511', renderNoStations())
    } else {
      await updateHeader('Glass Transit 511')
      await updateBody(renderNoStations())
    }
    return
  }

  const headerText = renderHeader(page.station, page.direction)

  if (useRebuild) {
    await rebuildDisplay(headerText, renderLoading())
  } else {
    await updateHeader(headerText)
    await updateBody(renderLoading())
  }

  const arrivals = await refreshCurrentArrivals(settings)
  if (!arrivals) return

  const trains = page.direction === 'N' ? arrivals.north : arrivals.south
  const bodyText = renderBody(
    page.station, page.direction, trains,
    currentIndex, pages.length
  )
  await updateBody(bodyText)
}

async function refreshInPlace(): Promise<void> {
  const page = currentPage()
  if (!page) return

  const settings = await getSettings()
  const arrivals = await refreshCurrentArrivals(settings)
  if (!arrivals) return

  const { pages, currentIndex } = getState()
  const trains = page.direction === 'N' ? arrivals.north : arrivals.south
  const bodyText = renderBody(
    page.station, page.direction, trains,
    currentIndex, pages.length
  )
  await updateBody(bodyText)
}

// ── Auto-refresh ──

async function startAutoRefresh(): Promise<void> {
  stopAutoRefresh()
  const settings = await getSettings()
  refreshTimer = setInterval(() => {
    refreshInPlace()
  }, settings.refreshInterval * 1000)
}

function stopAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// ── Startup ──

export async function startGlassesMode(b: EvenAppBridge): Promise<void> {
  bridge = b

  await loadStations()

  const page = currentPage()
  if (page) {
    await createInitialPage(
      renderHeader(page.station, page.direction),
      renderLoading()
    )
  } else {
    await createInitialPage('Glass Transit 511', renderNoStations())
  }

  if (page) {
    const settings = await getSettings()
    const arrivals = await refreshCurrentArrivals(settings)
    if (arrivals) {
      const { pages, currentIndex } = getState()
      const trains = page.direction === 'N' ? arrivals.north : arrivals.south
      await updateBody(
        renderBody(page.station, page.direction, trains, currentIndex, pages.length)
      )
    }
  }

  setupInput(b, {
    onScrollDown: () => {
      nextPage()
      displayCurrentPage(true)
    },
    onScrollUp: () => {
      prevPage()
      displayCurrentPage(true)
    },
    onTap: () => {
      refreshInPlace()
    },
    onDoubleTap: async () => {
      stopAutoRefresh()
      await b.shutDownPageContainer(0)
    },
    onForegroundEnter: () => {
      loadStations().then(() => displayCurrentPage(true))
      startAutoRefresh()
    },
    onForegroundExit: () => {
      stopAutoRefresh()
    },
  })

  await startAutoRefresh()

  window.addEventListener('glass-transit:sync', () => {
    loadStations().then(() => displayCurrentPage(true))
  })
}
