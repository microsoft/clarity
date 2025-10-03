import { AgentData } from "@clarity-types/agent";
import * as livechat from "@src/dynamic/agent/livechat";

export let data: AgentData = {
    messages: []
};

(function () {
  livechat.start();
})();
