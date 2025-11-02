<template>
  <div class="route-map-container" ref="mapContainer"></div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  initialHideSelector: {
    type: String,
    default: ''
  },
  animateNodeId: String,
  reservations: {
    type: Array,
    default: () => []
  },
  selectedSeat: String,
  highlightedPath: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['node-click']);

const mapContainer = ref(null);
let svgDoc = null;
const originalStyles = new Map();

const STYLES = {
  RESERVED: { fill: '#868e96' },
  SELECTED: { fill: '#28a745' },
};

onMounted(async () => {
  try {
    const response = await fetch('/route.svg');
    const svgText = await response.text();
    const parser = new DOMParser();
    svgDoc = parser.parseFromString(svgText, "image/svg+xml").documentElement;
    mapContainer.value.appendChild(svgDoc);
    
    svgDoc.querySelectorAll('path, rect, polygon, circle, ellipse').forEach(el => {
      originalStyles.set(el, { 
        fill: el.style.fill || el.getAttribute('fill'), 
        stroke: el.style.stroke || el.getAttribute('stroke'), 
        'stroke-width': el.style.strokeWidth || el.getAttribute('stroke-width')
      });
    });

    initializeMap();
    setupClickListeners();
    updateAllVisuals();

  } catch (error) {
    console.error('Error loading or processing SVG:', error);
  }
});

const initializeMap = () => {
  if (!svgDoc) return;
  if (props.initialHideSelector) {
    svgDoc.querySelectorAll(props.initialHideSelector).forEach(el => {
      el.style.display = 'none';
    });
  }
};

const setupClickListeners = () => {
  if (!svgDoc) return;
  svgDoc.querySelectorAll('[id^="N"]').forEach(seat => {
    seat.style.cursor = 'pointer';
    seat.addEventListener('click', (event) => {
      event.stopPropagation();
      emit('node-click', seat.id);
    });
  });
};

const applyStyleToGroup = (groupId, style) => {
  if (!svgDoc || !groupId) return;
  const group = svgDoc.getElementById(groupId);
  if (group) {
    const elements = group.querySelectorAll('path, rect, polygon, circle, ellipse');
    elements.forEach(el => {
      for (const [key, value] of Object.entries(style)) {
        el.style[key] = value;
      }
    });
  }
};

const revertStyleForGroup = (groupId) => {
  if (!svgDoc || !groupId) return;
  const group = svgDoc.getElementById(groupId);
  if (group) {
    const elements = group.querySelectorAll('path, rect, polygon, circle, ellipse');
    elements.forEach(el => {
      const original = originalStyles.get(el);
      if (original) {
        el.style.fill = original.fill;
        el.style.stroke = original.stroke;
        el.style['stroke-width'] = original['stroke-width'];
      } else {
        el.style.fill = '';
        el.style.stroke = '';
        el.style['stroke-width'] = '';
      }
    });
  }
};

const updateAllVisuals = () => {
  if (!svgDoc) return;

  svgDoc.querySelectorAll('[id^="N"]').forEach(seat => revertStyleForGroup(seat.id));
  
  svgDoc.querySelectorAll('.path-highlight, .blinking-node, .path-flashing').forEach(el => {
    el.classList.remove('path-highlight', 'blinking-node', 'path-flashing');
    el.style.animationDelay = ''; // Reset animation delay
    if (!el.id.startsWith('N')) {
      revertStyleForGroup(el.id);
    }
  });

  if (props.initialHideSelector) {
    svgDoc.querySelectorAll(props.initialHideSelector).forEach(el => {
       if (!props.highlightedPath.includes(el.id)) {
         el.style.display = 'none';
       }
    });
  }

  props.reservations.forEach(res => applyStyleToGroup(res.seatId, STYLES.RESERVED));

  if (props.selectedSeat) {
    applyStyleToGroup(props.selectedSeat, STYLES.SELECTED);
  }

  let animationCounter = 0;
  const animationDuration = 0.5; // seconds per segment
  const pathEdges = props.highlightedPath.filter(id => id.startsWith('DL') || id.startsWith('SD'));

  props.highlightedPath.forEach(id => {
    const el = svgDoc.getElementById(id);
    if (el) {
      el.style.display = '';
      el.classList.add('path-highlight');
      
      if (id.startsWith('DL') || id.startsWith('SD')) {
        el.style.animationDelay = `${animationCounter * animationDuration}s`;
        animationCounter++;
      }
    }
  });

  const totalAnimationTime = pathEdges.length * animationDuration;
  setTimeout(() => {
    props.highlightedPath.forEach(id => {
      const el = svgDoc.getElementById(id);
      if (el) {
        el.classList.add('path-flashing');
      }
    });
  }, totalAnimationTime * 1000);

  if (props.animateNodeId) {
    const nodeToAnimate = svgDoc.getElementById(props.animateNodeId);
    if (nodeToAnimate) nodeToAnimate.classList.add('blinking-node');
  }
};

watch(() => props.highlightedPath, updateAllVisuals, { deep: true });
watch(() => [props.reservations, props.selectedSeat, props.animateNodeId], () => {
  // Run updateAllVisuals in the next tick to ensure DOM is updated
  setTimeout(updateAllVisuals, 0);
}, { deep: true });

</script>

<style>
.route-map-container {
  width: 100%;
  height: 100%;
}
.route-map-container svg {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@keyframes blink-color {
  0%, 100% { fill: #fd7e14; }
  50% { fill: #495057; }
}
.blinking-node, .blinking-node * {
  animation: blink-color 1.5s infinite;
}

@keyframes draw-path {
  to { stroke-dashoffset: 0; }
}

@keyframes flash {
  0%, 100% { stroke: #009B8A; }
  50% { stroke: #00c6ff; }
}

/* Style for the animated EDGES of the path */
[id^="DL"].path-highlight, 
[id^="SD"].path-highlight {
  stroke: #009B8A !important;
  stroke-width: 24px !important;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: draw-path 0.5s ease-in-out forwards;
}

/* Style for the NODES of the path (no animation) */
[id^="d"].path-highlight *,
[id^="D"].path-highlight *,
[id^="S"].path-highlight * {
  fill: #009B8A !important;
}

.path-flashing {
  animation: flash 1s infinite;
}
</style>
