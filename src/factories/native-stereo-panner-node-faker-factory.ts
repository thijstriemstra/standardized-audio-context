import { interceptConnections } from '../helpers/intercept-connections';
import { INativeWaveShaperNodeFaker } from '../interfaces';
import {
    TChannelCountMode,
    TChannelInterpretation,
    TNativeAudioNode,
    TNativeChannelMergerNode,
    TNativeContext,
    TNativeGainNode,
    TNativeStereoPannerNode,
    TNativeStereoPannerNodeFakerFactoryFactory,
    TOverSampleType
} from '../types';

export const createNativeStereoPannerNodeFakerFactory: TNativeStereoPannerNodeFakerFactoryFactory = (
    createNativeChannelMergerNode,
    createNativeChannelSplitterNode,
    createNativeGainNode,
    createNativeWaveShaperNode,
    createNotSupportedError
) => {
    // The curve has a size of 14bit plus 1 value to have an exact representation for zero. This value has been determined experimentally.
    const CURVE_SIZE = 16385;
    const DC_CURVE = new Float32Array([ 1, 1 ]);
    const HALF_PI = Math.PI / 2;
    const SINGLE_CHANNEL_OPTIONS = {
        channelCount: 1,
        channelCountMode: <TChannelCountMode> 'explicit',
        channelInterpretation: <TChannelInterpretation> 'discrete'
    };
    const SINGLE_CHANNEL_WAVE_SHAPER_OPTIONS = { ...SINGLE_CHANNEL_OPTIONS, oversample: <TOverSampleType> 'none' };

    const buildInternalGraphForMono = (
        nativeContext: TNativeContext,
        inputGainNode: TNativeGainNode,
        panGainNode: TNativeGainNode,
        channelMergerNode: TNativeChannelMergerNode
    ) => {
        const leftWaveShaperCurve = new Float32Array(CURVE_SIZE);
        const rightWaveShaperCurve = new Float32Array(CURVE_SIZE);

        for (let i = 0; i < CURVE_SIZE; i += 1) {
            const x = (i / (CURVE_SIZE - 1)) * HALF_PI;

            leftWaveShaperCurve[i] = Math.cos(x);
            rightWaveShaperCurve[i] = Math.sin(x);
        }

        const leftGainNode = createNativeGainNode(nativeContext, { ...SINGLE_CHANNEL_OPTIONS, gain: 0 });
        // Bug #119: Safari does not fully support the WaveShaperNode.
        const leftWaveShaperNode = <INativeWaveShaperNodeFaker> createNativeWaveShaperNode(
            nativeContext,
            { ...SINGLE_CHANNEL_WAVE_SHAPER_OPTIONS, curve: leftWaveShaperCurve }
        );
        // Bug #119: Safari does not fully support the WaveShaperNode.
        const panWaveShaperNode = <INativeWaveShaperNodeFaker> createNativeWaveShaperNode(
            nativeContext,
            { ...SINGLE_CHANNEL_WAVE_SHAPER_OPTIONS, curve: DC_CURVE }
        );
        const rightGainNode = createNativeGainNode(nativeContext, { ...SINGLE_CHANNEL_OPTIONS, gain: 0 });
        // Bug #119: Safari does not fully support the WaveShaperNode.
        const rightWaveShaperNode = <INativeWaveShaperNodeFaker> createNativeWaveShaperNode(
            nativeContext,
            { ...SINGLE_CHANNEL_WAVE_SHAPER_OPTIONS, curve: rightWaveShaperCurve }
        );

        inputGainNode.connect(leftGainNode);
        inputGainNode.connect(panWaveShaperNode.inputs[0]);
        inputGainNode.connect(rightGainNode);

        panWaveShaperNode.connect(panGainNode);

        panGainNode.connect(leftWaveShaperNode.inputs[0]);
        panGainNode.connect(rightWaveShaperNode.inputs[0]);

        leftWaveShaperNode.connect(leftGainNode.gain);
        rightWaveShaperNode.connect(rightGainNode.gain);

        leftGainNode.connect(channelMergerNode, 0, 0);
        rightGainNode.connect(channelMergerNode, 0, 1);

        return [ leftGainNode, rightGainNode ];
    };

    const buildInternalGraphForStereo = (
        nativeContext: TNativeContext,
        inputGainNode: TNativeGainNode,
        panGainNode: TNativeGainNode,
        channelMergerNode: TNativeChannelMergerNode
    ) => {
        const leftInputForLeftOutputWaveShaperCurve = new Float32Array(CURVE_SIZE);
        const leftInputForRightOutputWaveShaperCurve = new Float32Array(CURVE_SIZE);
        const rightInputForLeftOutputWaveShaperCurve = new Float32Array(CURVE_SIZE);
        const rightInputForRightOutputWaveShaperCurve = new Float32Array(CURVE_SIZE);

        const centerIndex = Math.floor(CURVE_SIZE / 2);

        for (let i = 0; i < CURVE_SIZE; i += 1) {
            if (i > centerIndex) {
                const x = ((i - centerIndex) / (CURVE_SIZE - 1 - centerIndex)) * HALF_PI;

                leftInputForLeftOutputWaveShaperCurve[i] = Math.cos(x);
                leftInputForRightOutputWaveShaperCurve[i] = Math.sin(x);
                rightInputForLeftOutputWaveShaperCurve[i] = 0;
                rightInputForRightOutputWaveShaperCurve[i] = 1;
            } else {
                const x = (i / (CURVE_SIZE - 1 - centerIndex)) * HALF_PI;

                leftInputForLeftOutputWaveShaperCurve[i] = 1;
                leftInputForRightOutputWaveShaperCurve[i] = 0;
                rightInputForLeftOutputWaveShaperCurve[i] = Math.cos(x);
                rightInputForRightOutputWaveShaperCurve[i] = Math.sin(x);
            }
        }

        const channelSplitterNode = createNativeChannelSplitterNode(nativeContext, {
            channelCount: 2,
            channelCountMode: 'explicit',
            channelInterpretation: 'discrete',
            numberOfOutputs: 2
        });
        const leftInputForLeftOutputGainNode = createNativeGainNode(nativeContext, { ...SINGLE_CHANNEL_OPTIONS, gain: 0 });
        // Bug #119: Safari does not fully support the WaveShaperNode.
        const leftInputForLeftOutputWaveShaperNode = <INativeWaveShaperNodeFaker> createNativeWaveShaperNode(
            nativeContext,
            { ...SINGLE_CHANNEL_WAVE_SHAPER_OPTIONS, curve: leftInputForLeftOutputWaveShaperCurve }
        );
        const leftInputForRightOutputGainNode = createNativeGainNode(nativeContext, { ...SINGLE_CHANNEL_OPTIONS, gain: 0 });
        // Bug #119: Safari does not fully support the WaveShaperNode.
        const leftInputForRightOutputWaveShaperNode = <INativeWaveShaperNodeFaker> createNativeWaveShaperNode(
            nativeContext,
            { ...SINGLE_CHANNEL_WAVE_SHAPER_OPTIONS, curve: leftInputForRightOutputWaveShaperCurve }
        );
        // Bug #119: Safari does not fully support the WaveShaperNode.
        const panWaveShaperNode = <INativeWaveShaperNodeFaker> createNativeWaveShaperNode(
            nativeContext,
            { ...SINGLE_CHANNEL_WAVE_SHAPER_OPTIONS, curve: DC_CURVE }
        );
        const rightInputForLeftOutputGainNode = createNativeGainNode(nativeContext, { ...SINGLE_CHANNEL_OPTIONS, gain: 0 });
        // Bug #119: Safari does not fully support the WaveShaperNode.
        const rightInputForLeftOutputWaveShaperNode = <INativeWaveShaperNodeFaker> createNativeWaveShaperNode(
            nativeContext,
            { ...SINGLE_CHANNEL_WAVE_SHAPER_OPTIONS, curve: rightInputForLeftOutputWaveShaperCurve });
        const rightInputForRightOutputGainNode = createNativeGainNode(nativeContext, { ...SINGLE_CHANNEL_OPTIONS, gain: 0 });
        // Bug #119: Safari does not fully support the WaveShaperNode.
        const rightInputForRightOutputWaveShaperNode = <INativeWaveShaperNodeFaker> createNativeWaveShaperNode(
            nativeContext,
            { ...SINGLE_CHANNEL_WAVE_SHAPER_OPTIONS, curve: rightInputForRightOutputWaveShaperCurve }
        );

        inputGainNode.connect(channelSplitterNode);
        inputGainNode.connect(panWaveShaperNode.inputs[0]);

        channelSplitterNode.connect(leftInputForLeftOutputGainNode, 1);
        channelSplitterNode.connect(leftInputForRightOutputGainNode, 1);
        channelSplitterNode.connect(rightInputForLeftOutputGainNode, 1);
        channelSplitterNode.connect(rightInputForRightOutputGainNode, 1);

        panWaveShaperNode.connect(panGainNode);

        panGainNode.connect(leftInputForLeftOutputWaveShaperNode.inputs[0]);
        panGainNode.connect(leftInputForRightOutputWaveShaperNode.inputs[0]);
        panGainNode.connect(rightInputForLeftOutputWaveShaperNode.inputs[0]);
        panGainNode.connect(rightInputForRightOutputWaveShaperNode.inputs[0]);

        leftInputForLeftOutputWaveShaperNode.connect(leftInputForLeftOutputGainNode.gain);
        leftInputForRightOutputWaveShaperNode.connect(leftInputForRightOutputGainNode.gain);
        rightInputForLeftOutputWaveShaperNode.connect(rightInputForLeftOutputGainNode.gain);
        rightInputForRightOutputWaveShaperNode.connect(rightInputForRightOutputGainNode.gain);

        leftInputForLeftOutputGainNode.connect(channelMergerNode, 0, 0);
        rightInputForLeftOutputGainNode.connect(channelMergerNode, 0, 0);

        leftInputForRightOutputGainNode.connect(channelMergerNode, 0, 1);
        rightInputForRightOutputGainNode.connect(channelMergerNode, 0, 1);

        return [
            leftInputForLeftOutputGainNode,
            rightInputForLeftOutputGainNode,
            leftInputForRightOutputGainNode,
            rightInputForRightOutputGainNode
        ];
    };

    const buildInternalGraph = (
        nativeContext: TNativeContext,
        channelCount: number,
        inputGainNode: TNativeGainNode,
        panGainNode: TNativeGainNode,
        channelMergerNode: TNativeChannelMergerNode
    ) => {
        if (channelCount === 1) {
            return buildInternalGraphForMono(nativeContext, inputGainNode, panGainNode, channelMergerNode);
        } else if (channelCount === 2) {
            return buildInternalGraphForStereo(nativeContext, inputGainNode, panGainNode, channelMergerNode);
        }

        throw createNotSupportedError();
    };

    return (nativeContext, { channelCount, channelCountMode, pan, ...audioNodeOptions }) => {
        if (channelCountMode === 'max') {
            throw createNotSupportedError();
        }

        const channelMergerNode = createNativeChannelMergerNode(nativeContext, {
            ...audioNodeOptions,
            channelCount: 1,
            channelCountMode,
            numberOfInputs: 2
        });
        const inputGainNode = createNativeGainNode(nativeContext, { ...audioNodeOptions, channelCount, channelCountMode, gain: 1 });
        const panGainNode = createNativeGainNode(nativeContext, {
            channelCount: 1,
            channelCountMode: 'explicit',
            channelInterpretation: 'discrete',
            gain: pan
        });

        let outputNodes = buildInternalGraph(nativeContext, channelCount, inputGainNode, panGainNode, channelMergerNode);

        Object.defineProperty(panGainNode.gain, 'defaultValue', { get: () => 0 });

        const nativeStereoPannerNodeFakerFactory = {
            get bufferSize (): undefined {
                return undefined;
            },
            get channelCount (): number {
                return inputGainNode.channelCount;
            },
            set channelCount (value) {
                if (inputGainNode.channelCount !== value) {
                    inputGainNode.disconnect();
                    outputNodes.forEach((outputNode) => outputNode.disconnect());

                    outputNodes = buildInternalGraph(nativeContext, value, inputGainNode, panGainNode, channelMergerNode);
                }

                inputGainNode.channelCount = value;
            },
            get channelCountMode (): TNativeStereoPannerNode['channelCountMode'] {
                return inputGainNode.channelCountMode;
            },
            set channelCountMode (value) {
                if (value === 'clamped-max' || value === 'max') {
                    throw createNotSupportedError();
                }

                inputGainNode.channelCountMode = value;
            },
            get channelInterpretation (): TNativeStereoPannerNode['channelInterpretation'] {
                return inputGainNode.channelInterpretation;
            },
            set channelInterpretation (value) {
                inputGainNode.channelInterpretation = value;
            },
            get context (): TNativeStereoPannerNode['context'] {
                return inputGainNode.context;
            },
            get inputs (): TNativeAudioNode[] {
                return [ inputGainNode ];
            },
            get numberOfInputs (): number {
                return inputGainNode.numberOfInputs;
            },
            get numberOfOutputs (): number {
                return inputGainNode.numberOfOutputs;
            },
            get pan (): TNativeStereoPannerNode['pan'] {
                return panGainNode.gain;
            },
            addEventListener (...args: any[]): void {
                return inputGainNode.addEventListener(args[0], args[1], args[2]);
            },
            dispatchEvent (...args: any[]): boolean {
                return inputGainNode.dispatchEvent(args[0]);
            },
            removeEventListener (...args: any[]): void {
                return inputGainNode.removeEventListener(args[0], args[1], args[2]);
            }
        };

        return interceptConnections(nativeStereoPannerNodeFakerFactory, channelMergerNode);
    };
};
