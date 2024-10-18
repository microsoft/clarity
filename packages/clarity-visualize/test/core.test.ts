import { assert } from 'chai';
import { DecodedPayload } from 'clarity-decode/types/data';
import { Visualizer } from "clarity-visualize";

describe('Visualize Tests', () => {

    it('element that never goes away should have empty end time', async () => {
        let hashToFind = 'xijfjrul';
        let decoded: DecodedPayload[] = [
            {
                timestamp: 0,
                envelope: {
                    sequence: 0,
                    start: 0,
                    duration: 0,
                    version: "0.0.0",
                    upload: 0,
                    end: 0,
                    projectId: "test",
                    userId: "test",
                    sessionId: "test",
                    pageNum: 0
                },
                dom: [
                    {
                        time: 0,
                        event: 5,
                        data: [
                            {
                                id: 2,
                                parent: null as any,
                                previous: null as any,
                                tag: "*D"
                              },
                              {
                                id: 3,
                                parent: 1,
                                previous: 2,
                                tag: "HTML",
                              },
                              {
                                id: 4,
                                parent: 3,
                                previous: null,
                                tag: "HEAD"
                              },
                        ]
                    }
                ],

            }
        ];

        let visualizer = new Visualizer();
        let existenceTimes = visualizer.getElementExistenceTimes(decoded, hashToFind);
        
        assert.equal(existenceTimes.length, 1);
        assert.equal(existenceTimes[0].begin, 0);
        assert.equal(existenceTimes[0].end, undefined);
    });

    it('element that goes away should have non-empty end time', async () => {
        let hashToFind = 'xijfjrul';
        let decoded: DecodedPayload[] = [
            {
                timestamp: 0,
                envelope: {
                    sequence: 0,
                    start: 0,
                    duration: 0,
                    version: "0.0.0",
                    upload: 0,
                    end: 0,
                    projectId: "test",
                    userId: "test",
                    sessionId: "test",
                    pageNum: 0
                },
                dom: [
                    {
                        time: 0,
                        event: 5,
                        data: [
                            {
                                id: 2,
                                parent: null as any,
                                previous: null as any,
                                tag: "*D"
                              },
                              {
                                id: 3,
                                parent: 1,
                                previous: 2,
                                tag: "HTML",
                              },
                              {
                                id: 4,
                                parent: 3,
                                previous: null,
                                tag: "HEAD"
                              },
                        ]
                    },
                    {
                        time: 10,
                        event: 6,
                        data: [
                            {
                                id: 4,
                                parent: null as any,
                                previous: null as any,
                                tag: "HEAD"
                              }
                        ]
                    }
                ],

            }
        ];

        let visualizer = new Visualizer();
        let existenceTimes = visualizer.getElementExistenceTimes(decoded, hashToFind);
        
        assert.equal(existenceTimes.length, 1);
        assert.equal(existenceTimes[0].begin, 0);
        assert.equal(existenceTimes[0].end, 10);
    });

    it('element that reappears should note both times', async () => {
        let hashToFind = 'xijfjrul';
        let decoded: DecodedPayload[] = [
            {
                timestamp: 0,
                envelope: {
                    sequence: 0,
                    start: 0,
                    duration: 0,
                    version: "0.0.0",
                    upload: 0,
                    end: 0,
                    projectId: "test",
                    userId: "test",
                    sessionId: "test",
                    pageNum: 0
                },
                dom: [
                    {
                        time: 0,
                        event: 5,
                        data: [
                            {
                                id: 2,
                                parent: null as any,
                                previous: null as any,
                                tag: "*D"
                              },
                              {
                                id: 3,
                                parent: 1,
                                previous: 2,
                                tag: "HTML",
                              },
                              {
                                id: 4,
                                parent: 3,
                                previous: null,
                                tag: "HEAD"
                              },
                        ]
                    },
                    {
                        time: 10,
                        event: 6,
                        data: [
                            {
                                id: 4,
                                parent: null as any,
                                previous: null as any,
                                tag: "HEAD"
                              }
                        ]
                    }
                ],
            },
            {
                timestamp: 20,
                envelope: {
                    sequence: 1,
                    start: 0,
                    duration: 0,
                    version: "0.0.0",
                    upload: 0,
                    end: 0,
                    projectId: "test",
                    userId: "test",
                    sessionId: "test",
                    pageNum: 0
                },
                dom: [
                    {
                        time: 20,
                        event: 6,
                        data: [
                            {
                                id: 4,
                                parent: 3,
                                previous: null as any,
                                tag: "HEAD"
                              }
                        ]
                    },
                    {
                        time: 25,
                        event: 6,
                        data: [
                            {
                                id: 4,
                                parent: null as any,
                                previous: null as any,
                                tag: "HEAD"
                              }
                        ]
                    }
                ],
            }
        ];

        let visualizer = new Visualizer();
        let existenceTimes = visualizer.getElementExistenceTimes(decoded, hashToFind);
        
        assert.equal(existenceTimes.length, 2);
        assert.equal(existenceTimes[0].begin, 0);
        assert.equal(existenceTimes[0].end, 10);
        assert.equal(existenceTimes[1].begin, 20);
        assert.equal(existenceTimes[1].end, 25);
    });

});
