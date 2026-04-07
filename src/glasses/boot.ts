/**
 * Glasses mode entry point.
 *
 * Initializes storage, loads stations, creates the two-container display,
 * sets up input handling, and starts auto-refresh.
 *
 * Adapted from SubwayLens main.ts — same structure, same SDK calls.
 */

import {
  CreateStartUpPageContainer,
  TextContainerProperty,
  RebuildPageContainer,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { initStorage, getSettings } from '../lib/storage'
import {
  loadStations,
  currentStation,
  nextStation,
  prevStation,
  refreshCurrentArrivals,
  isFavorite,
  getState,
} from './stations'
import {
  renderHeader,
  renderBody,
  renderLoading,
  renderNoStations,
} from './display'
import { setupInput } from './input'

// ── Container IDs ──
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
          xPosition: 0,
          yPosition: 0,
          width: 576,
          height: 28,
          borderWidth: 0,
          borderColor: 0,
          borderRadius: 0,
          paddingLength: 4,
          containerID: HEADER_ID,
          containerName: HEADER_NAME,
          content: headerText,
          isEventCapture: 0,
        }),
        new TextContainerProperty({
          xPosition: 0,
          yPosition: 28,
          width: 576,
          height: 260,
          borderWidth: 0,
          borderColor: 0,
          borderRadius: 0,
          paddingLength: 4,
          containerID: BODY_ID,
          containerName: BODY_NAME,
          content: bodyText,
          isEventCapture: 1,
        }),
      ],
    })
  )
}

async function rebuildPage(
  headerText: string,
  bodyText: string
): Promise<void> {
  if (!bridge) return
  await bridge.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          xPosition: 0,
          yPosition: 0,
          width: 576,
          height: 28,
          borderWidth: 0,
          borderColor: 0,
          borderRadius: 0,
          paddingLength: 4,
          containerID: HEADER_ID,
          containerName: HEADER_NAME,
          content: headerText,
          isEventCapture: 0,
        }),
        new TextContainerProperty({
          xPosition: 0,
          yPosition: 28,
          width: 576,
          height: 260,
          borderWidth: 0,
          borderColor: 0,
          borderRadius: 0,
          paddingLength: 4,
          containerID: BODY_ID,
          containerName: BODY_NAME,
          content: bodyText,
          isEventCapture: 1,
        }),
      ],
    })
  )
}

async function updateBody(text: string): Promise<void> {
  if (!bridge) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: BODY_ID,
      containerName: BODY_NAME,
      contentOffset: 0,
      contentLength: 2000,
      content: text,
    })
  )
}

async function updateHeader(text: string): Promise<void> {
  if (!bridge) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: HEADER_ID,
      containerName: HEADER_NAME,
      contentOffset: 0,
      contentLength: 1000,
      content: text,
    })
  )
}

// ── Display update logic ──

async function displayCurrentStation(useRebuild: boolean): Promise<void> {
  const station = currentStation()
  const { stations, currentIndex } = getState()
  const settings = await getSettings()

  if (!station) {
    if (useRebuild) {
      await rebuildPage('Glass Transit', renderNoStations())
    } else {
      await updateHeader('Glass Transit')
      await updateBody(renderNoStations())
    }
    return
  }

  const headerText = renderHeader(station, isFavorite(station.id))

  // Show loading
  if (useRebuild) {
    await rebuildPage(headerText, renderLoading())
  } else {
    await updateHeader(headerText)
    await updateBody(renderLoading())
  }

  // Fetch arrivals
  const arrivals = await refreshCurrentArrivals(settings)
  if (!arrivals) return

  const bodyText = renderBody(station, arrivals, currentIndex, stations.length)
  await updateBody(bodyText)
}

async function refreshInPlace(): Promise<void> {
  const station = currentStation()
  if (!station) return

  const settings = await getSettings()
  const arrivals = await refreshCurrentArrivals(settings)
  if (!arrivals) return

  const { stations, currentIndex } = getState()
  const bodyText = renderBody(station, arrivals, currentIndex, stations.length)
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
  initStorage(b)

  await loadStations()

  // Create initial page
  const station = currentStation()
  if (station) {
    await createInitialPage(
      renderHeader(station, isFavorite(station.id)),
      renderLoading()
    )
  } else {
    await createInitialPage('Glass Transit', renderNoStations())
  }

  // Fetch and display arrivals
  if (station) {
    const settings = await getSettings()
    const arrivals = await refreshCurrentArrivals(settings)
    if (arrivals) {
      const { stations, currentIndex } = getState()
      await updateBody(
        renderBody(station, arrivals, currentIndex, stations.length)
      )
    }
  }

  // Input handling
  setupInput(b, {
    onScrollDown: () => {
      nextStation()
      displayCurrentStation(true)
    },
    onScrollUp: () => {
      prevStation()
      displayCurrentStation(true)
    },
    onTap: () => {
      refreshInPlace()
    },
    onDoubleTap: async () => {
      stopAutoRefresh()
      await b.shutDownPageContainer(0)
    },
    onForegroundEnter: () => {
      loadStations().then(() => displayCurrentStation(true))
      startAutoRefresh()
    },
    onForegroundExit: () => {
      stopAutoRefresh()
    },
  })

  await startAutoRefresh()

  // Listen for sync from settings page
  window.addEventListener('glass-transit:sync', () => {
    loadStations().then(() => displayCurrentStation(true))
  })
}
