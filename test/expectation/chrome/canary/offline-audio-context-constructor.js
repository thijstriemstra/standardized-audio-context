import { spy } from 'sinon';

describe('offlineAudioContextConstructor', () => {

    let offlineAudioContext;

    beforeEach(() => {
        offlineAudioContext = new OfflineAudioContext(1, 256000, 44100);
    });

    describe('createBufferSource()', () => {

        // bug #14

        it('should not resample an oversampled AudioBuffer', (done) => {
            const audioBuffer = offlineAudioContext.createBuffer(1, 8, 88200);
            const audioBufferSourceNode = offlineAudioContext.createBufferSource();
            const eightRandomValues = [];

            for (let i = 0; i < 8; i += 1) {
                eightRandomValues[i] = (Math.random() * 2) - 1;
            }

            audioBuffer.copyToChannel(new Float32Array(eightRandomValues), 0);

            audioBufferSourceNode.buffer = audioBuffer;
            audioBufferSourceNode.start(0);
            audioBufferSourceNode.connect(offlineAudioContext.destination);

            offlineAudioContext
                .startRendering()
                .then((buffer) => {
                    const channelData = new Float32Array(4);

                    buffer.copyFromChannel(channelData, 0);

                    expect(channelData[0]).to.closeTo(eightRandomValues[0], 0.0000001);
                    expect(channelData[1]).to.closeTo(eightRandomValues[2], 0.0000001);
                    expect(channelData[2]).to.closeTo(eightRandomValues[4], 0.0000001);
                    expect(channelData[3]).to.closeTo(eightRandomValues[6], 0.0000001);

                    done();
                });
        });

        // bug #148

        it('should not render a nullified AudioBuffer as silence', (done) => {
            const audioBuffer = offlineAudioContext.createBuffer(1, 5, 44100);
            const audioBufferSourceNode = offlineAudioContext.createBufferSource();
            const fiveRandomValues = [];

            for (let i = 0; i < 5; i += 1) {
                fiveRandomValues[i] = (Math.random() * 2) - 1;
            }

            audioBuffer.copyToChannel(new Float32Array(fiveRandomValues), 0);

            audioBufferSourceNode.buffer = audioBuffer;
            audioBufferSourceNode.buffer = null;
            audioBufferSourceNode.start(0);
            audioBufferSourceNode.connect(offlineAudioContext.destination);

            offlineAudioContext
                .startRendering()
                .then((buffer) => {
                    const channelData = new Float32Array(5);

                    buffer.copyFromChannel(channelData, 0);

                    expect(channelData[0]).to.closeTo(fiveRandomValues[0], 0.0000001);
                    expect(channelData[1]).to.closeTo(fiveRandomValues[1], 0.0000001);
                    expect(channelData[2]).to.closeTo(fiveRandomValues[2], 0.0000001);
                    expect(channelData[3]).to.closeTo(fiveRandomValues[3], 0.0000001);
                    expect(channelData[4]).to.closeTo(fiveRandomValues[4], 0.0000001);

                    done();
                });
        });

    });

    describe('decodeAudioData()', () => {

        // bug #6

        it('should not call the errorCallback at all', (done) => {
            const errorCallback = spy();

            offlineAudioContext.decodeAudioData(null, () => {}, errorCallback);

            setTimeout(() => {
                expect(errorCallback).to.have.not.been.called;

                done();
            }, 1000);
        });

    });

});
