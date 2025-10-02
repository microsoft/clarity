import { AgentData } from "@clarity-types/agent";
import * as livechat from "@src/agent/livechat";

export let data: AgentData = {
    messages: []
};

(function () {
  livechat.start();
})();
