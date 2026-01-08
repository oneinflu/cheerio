import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Calculator, Check, DollarSign, Percent } from 'lucide-react';
import { cn } from '../lib/utils';

const COURSES = [
  { id: 'fsd', name: 'Full Stack Web Development', basePrice: 45000 },
  { id: 'ds', name: 'Data Science & AI', basePrice: 55000 },
  { id: 'dm', name: 'Digital Marketing Masterclass', basePrice: 35000 },
  { id: 'ux', name: 'UI/UX Design Specialization', basePrice: 40000 },
];

const PACKAGES = [
  { id: 'basic', name: 'Basic (Self-Paced)', multiplier: 1.0 },
  { id: 'pro', name: 'Pro (Live Classes)', multiplier: 1.5 },
  { id: 'premium', name: 'Premium (1-on-1 Mentorship)', multiplier: 2.0 },
];

const DISCOUNT_CHIPS_PERCENT = [5, 10, 15, 20, 25, 50];
const DISCOUNT_CHIPS_VALUE = [1000, 2000, 5000, 10000];

export function ProposalModal({ isOpen, onClose, onSend }) {
  const [courseId, setCourseId] = useState(COURSES[0].id);
  const [packageId, setPackageId] = useState(PACKAGES[1].id);
  const [basePrice, setBasePrice] = useState(0);
  const [discountType, setDiscountType] = useState('percent'); // 'percent' | 'value'
  const [discountValue, setDiscountValue] = useState(10);
  const [finalPrice, setFinalPrice] = useState(0);

  // Update base price when course or package changes
  useEffect(() => {
    const course = COURSES.find(c => c.id === courseId);
    const pkg = PACKAGES.find(p => p.id === packageId);
    if (course && pkg) {
      setBasePrice(course.basePrice * pkg.multiplier);
    }
  }, [courseId, packageId]);

  // Calculate final price
  useEffect(() => {
    let final = basePrice;
    if (discountType === 'percent') {
      final = basePrice * (1 - discountValue / 100);
    } else {
      final = Math.max(0, basePrice - discountValue);
    }
    setFinalPrice(Math.round(final));
  }, [basePrice, discountType, discountValue]);

  const handleSend = () => {
    const course = COURSES.find(c => c.id === courseId);
    const pkg = PACKAGES.find(p => p.id === packageId);
    
    const proposalData = {
      courseName: course?.name,
      packageName: pkg?.name,
      originalPrice: basePrice,
      discountType,
      discountValue,
      finalPrice
    };
    
    onSend(proposalData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Proposal">
      <div className="space-y-5">
        
        {/* Course & Package Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Select Course</label>
            <select 
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              {COURSES.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Package</label>
            <select 
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
            >
              {PACKAGES.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Price & Discount Mode */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Base Price</label>
          <div className="relative">
             <span className="absolute left-3 top-2.5 text-slate-400">₹</span>
             <Input 
               type="number" 
               value={basePrice} 
               onChange={(e) => setBasePrice(Number(e.target.value))}
               className="pl-7 font-mono"
             />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Discount</label>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setDiscountType('percent')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  discountType === 'percent' ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Percentage (%)
              </button>
              <button
                onClick={() => setDiscountType('value')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  discountType === 'value' ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Flat Value (₹)
              </button>
            </div>
          </div>

          <div className="relative">
             <span className="absolute left-3 top-2.5 text-slate-400">
               {discountType === 'value' ? '₹' : <Percent size={14} />}
             </span>
             <Input 
               type="number" 
               value={discountValue} 
               onChange={(e) => setDiscountValue(Number(e.target.value))}
               className="pl-8"
             />
          </div>

          <div className="flex flex-wrap gap-2">
            {(discountType === 'percent' ? DISCOUNT_CHIPS_PERCENT : DISCOUNT_CHIPS_VALUE).map(val => (
              <button
                key={val}
                onClick={() => setDiscountValue(val)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-full border transition-colors",
                  discountValue === val 
                    ? "bg-blue-50 border-blue-200 text-blue-700 font-medium" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {discountType === 'percent' ? `${val}%` : `₹${val.toLocaleString()}`}
              </button>
            ))}
          </div>
        </div>

        {/* Final Calculation */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-1">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Original Price</span>
            <span className="line-through">₹{basePrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount Applied</span>
            <span>
              - {discountType === 'percent' ? `${discountValue}%` : `₹${discountValue.toLocaleString()}`} 
              {discountType === 'percent' && ` (₹${Math.round(basePrice * (discountValue/100)).toLocaleString()})`}
            </span>
          </div>
          <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center">
            <span className="font-medium text-slate-900">Final Price</span>
            <span className="text-xl font-bold text-blue-600">₹{finalPrice.toLocaleString()}</span>
          </div>
        </div>

        <div className="pt-2">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="lg" onClick={handleSend}>
            Send Proposal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
