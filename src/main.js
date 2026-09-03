import { loadState, runtime } from "./state.js";
import "./domain.js";
import "./selectionOverride.js";
import "./utils.js";
import "./grid.js";
import "./imageExport.js";
import {
  renderLocationList,
  renderTravelMatrix,
  renderAvailabilityList,
} from "./pages/settings.js";
import {
  populateMemberLocationSelect,
  renderMemberTable,
  renderRequestList,
} from "./pages/memberSchedule.js";
import "./engine/greedy.js";
import "./engine/chainDp.js";
import { renderSchedule3Result, goToPage } from "./schedule3.js";
import "./backup.js";

/* ---------------- Init ---------------- */
function init() {
  loadState();
  renderLocationList();
  renderTravelMatrix();
  populateMemberLocationSelect();
  renderMemberTable();
  renderAvailabilityList();
  renderRequestList();
  renderSchedule3Result();
  goToPage(runtime.currentPage);
}

init();
