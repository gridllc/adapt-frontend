
import type { TrainingModule } from '@/types';

// Mock data for a training module, now including an alternative method and a transcript.
export const MOCK_SANDWICH_MODULE: TrainingModule = {
  slug: 'sandwich-making',
  title: 'How to Make Our Signature Sandwich',
  videoUrl: 'https://storage.googleapis.com/web-dev-assets/video-api-demo/flowers.mp4', // Placeholder video
  steps: [
    { 
      start: 0, 
      end: 10, 
      title: "Step 1: Prepare Your Station",
      description: "First, wash your hands and put on a fresh pair of gloves. Ensure your cutting board is clean and your knife is sharp.",
      checkpoint: "What is the very first thing you should do?",
      alternativeMethods: []
    },
    { 
      start: 10, 
      end: 20, 
      title: "Step 2: Toast the Sourdough Bread",
      description: "Take two slices of sourdough bread. Place them in the conveyor toaster set to level 3. It should be golden brown, not dark.",
      checkpoint: "What setting should the toaster be on?",
      alternativeMethods: []
    },
    { 
      start: 20, 
      end: 35, 
      title: "Step 3: Apply the Signature Sauce",
      description: "Spread one tablespoon of our signature aioli on both slices of the toasted bread, covering it edge to edge.",
      checkpoint: null,
      alternativeMethods: []
    },
    { 
      start: 35, 
      end: 45, 
      title: "Step 4: Layer the Turkey",
      description: "Weigh out 4 ounces of sliced turkey. Gently fold and layer it evenly on the bottom slice of bread.",
      checkpoint: "How much turkey should you use?",
      alternativeMethods: [
        {
          title: "Quick-Fold Method (for rush hours)",
          description: "Instead of weighing, you can use 6 folded slices of turkey as a close approximation. This is faster but less precise."
        }
      ]
    },
    { 
      start: 45, 
      end: 55, 
      title: "Step 5: Add Provolone Cheese & Veggies",
      description: "Place two slices of Provolone cheese on top of the turkey. Then, add three rings of red onion and a handful of arugula.",
      checkpoint: null,
      alternativeMethods: []
    },
    { 
      start: 55, 
      end: 60, 
      title: "Step 6: Final Assembly",
      description: "Place the top slice of bread on, slice the sandwich diagonally, and serve immediately with a pickle spear.",
      checkpoint: "How is the sandwich cut?",
      alternativeMethods: []
    },
  ],
  transcript: [
    { start: 0, end: 3, text: "Alright, let's get started. First, make sure you wash your hands thoroughly." },
    { start: 3, end: 6, text: "And put on a fresh pair of gloves. This is key for food safety." },
    { start: 6, end: 10, text: "Make sure your station is clean, your cutting board is sanitized, and your knife is nice and sharp." },
    { start: 10, end: 13, text: "Next, we'll toast our sourdough bread. Grab two slices." },
    { start: 13, end: 17, text: "Place them in the conveyor toaster. We want this on level 3." },
    { start: 17, end: 20, text: "This should give it a perfect golden brown color, not too dark." },
    { start: 20, end: 23, text: "Once the bread is toasted, it's time for our signature sauce." },
    { start: 23, end: 28, text: "Take one tablespoon of the aioli and spread it on both slices." },
    { start: 28, end: 35, text: "Make sure you get it all the way to the edges for flavor in every bite." },
    { start: 35, end: 40, text: "Now for the turkey. Weigh out exactly 4 ounces of our premium sliced turkey." },
    { start: 40, end: 45, text: "Gently fold and layer it on the bottom slice of bread." },
    { start: 45, end: 50, text: "Then, add two slices of Provolone cheese right on top of the turkey." },
    { start: 50, end: 55, text: "Follow that with three rings of red onion and a nice handful of arugula for some peppery bite." },
    { start: 55, end: 57, text: "Okay, time to finish it up. Place the top slice of bread on." },
    { start: 57, end: 59, text: "Slice the sandwich diagonally. It just looks better that way." },
    { start: 59, end: 62, text: "And serve it immediately with a pickle spear on the side. Enjoy!" }
  ]
};